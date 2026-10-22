---
layout: post
title: "PHP2Shell - From Session Upload-Progress UAF to Multi-Stage RCE"
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

### Setting up the lab

I built the targets as containers from the official `php:*-apache` images. Keep in mind that the worker model matters here, so I pinned Apache to prefork with a single worker, which keeps the process-reuse behaviour deterministic.

``` bash
# vulnerable target, bound to loopback only
docker run -d --name php2shell-target \
  -p 127.0.0.1:8088:80 \
  php:8.4.26-apache
```

For reproducibility, I recorded the exact version, the SAPI, the loaded modules, and the relevant INI settings (`session.upload_progress.enabled`, `session.use_strict_mode`, `memory_limit`, `post_max_size`). I also built the patched versions side by side, so that every test I ran against the vulnerable build could be repeated against the fixed one.

### The differential that matters

Before building any exploit, I wanted to know which versions actually behave differently. I recorded the stage-one information disclosure as a simple signal: how many bytes came back from the over-read on the `Set-Cookie` header.

| PHP | Status | stage-1 leak | RCE |
|---|---|---|---|
| 8.4.26 | vulnerable | 4096 B | Yes |
| 8.3.35 | vulnerable | 4096 B | Yes |
| 8.4.27 | patched | 32 B | No |
| 8.3.36 | patched | 32 B | No |
| 8.2.34 and below | different mechanism | none | No |

That table is the whole argument. If the leak does not fire on the patched build, the chain has nothing to stand on. The 32-byte result on the patched builds is the normal, expected cookie length, which means the dangling pointer was cleared correctly.

### Why 8.2 and below do not pop

The chain hinges on one specific condition: `PS(send_cookie)` staying set across requests. On PHP 8.3 and above, when headers have already been sent, the cookie-send path leaves `send_cookie` set, so the next request reuses the stale session id and the over-read fires. On PHP 8.2 and below, that flag is reset, so a fresh id is generated and the stale pointer never survives.

I confirmed this in gdb. At the second request, `PS(send_cookie)` was `1` on 8.3.35 and `0` on 8.2.34. This was not a calibration problem on my side, because a filler scan from 200 to 2000 on 8.2.34 returned zero hits.

### Building the chain

I split the work into five stages, each one producing a JSON artifact that the next stage consumes. No stage is allowed to hardcode an address, because every one of them is discovered at runtime.

1. **Recon** - fingerprint the PHP version from `X-Powered-By`, read the `zif_system` and `zval_ptr_dtor` offsets from the target's `libphp.so` using my own ELF parser, and select the right struct profile.
2. **Info leak (heap)** - an out-of-memory bailout leaves the session id dangling, and a forged `zend_string` combined with `php_url_encode` over-reads into the Zend MM chunk, giving me a 2 MB-aligned chunk base.
3. **Info leak (code)** - a 56-byte fake HashTable placed over the dangling id makes `ZSTR_LEN` read the hash-table header, which exposes `pDestructor` and therefore the `libphp` base.
4. **Corruption** - a 15-byte carrier overwrites the dangling reference's value, and a 167-byte blob plants a fake `zend_array`, a fake `zend_execute_data`, and a fake `zend_string`.
5. **Execution** - `php_session_track_init()` calls `zval_ptr_dtor()` on the reference, which reaches `zend_array_destroy()` and finally calls `pDestructor`, which I redirected to `zif_system()`.

The reason stage 5 works is that `pDestructor` is a function pointer stored inside the fake `zend_array`. Once I control that pointer and control the string that gets passed as the argument, the call becomes `zif_system(cmd)`.

### The mechanism in one paragraph

The root cause is that the session state is torn down while a pointer to it is still held. On PHP 8.3 and above, the stale pointer survives into the next request. I use that stale pointer as a primitive: first to over-read memory and leak addresses, then to write a fake object, and finally to redirect a function pointer. The upstream fix adds an `in_rfc1867_update` flag so that the session is not re-entered while it is already being updated.

### Evidence

The payload is a benign `id` command. The output was captured from inside the container:

``` text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

That is code execution running as the web worker user. On the patched builds, the same chain stops at stage two and no command runs.

I want to be precise about what the evidence does and does not show. The chain reached the vulnerable path, reproduced the memory-safety violation, demonstrated information disclosure, achieved control-flow hijack, and finally achieved code execution. Each of those is a separate claim, and each one is backed by a different artifact in the lab.

### What I would not claim

The chain is not universal. The calibration constants are build-specific, so they have to be re-derived after any target rebuild. The mechanism only fires on PHP 8.3 and above with a single-worker prefork setup, and it is probabilistic rather than a guaranteed one-shot. I would not describe it as a reliable exploit for every affected configuration.

For a report, I would record the exact image digests, the INI settings, the gdb observations, the leaked addresses, and the captured output for both the vulnerable and the patched builds.

### Conclusion

The main takeaway for me is that a described vulnerability and a working exploit are two different things. Breaking the chain into stages, and forcing each stage to produce a verifiable artifact, is what turned a memory-safety observation into code execution.

The differential against the patched builds is the most important result here, because it shows the fix actually removes the primitive rather than just changing the symptoms. The goal was to build a chain I could reason about stage by stage, and that is what I did.

---

## Reproducing this

The whole PoC is a single self-contained file, `exploit/php2shell_exploit.py` (HTTP transport, ELF symbol extraction, version profiles, stages 1–5, calibration, and the orchestrator). The lab target config lives under `lab/`. To reproduce:

``` bash
mkdir -p lab/out && chmod 777 lab/out
sudo docker run -d --name php2shell-target -p 127.0.0.1:8088:80 \
  -v "$PWD/lab/www:/var/www/html:ro" \
  -v "$PWD/lab/php.ini:/usr/local/etc/php/conf.d/zz-php2shell.ini:ro" \
  -v "$PWD/lab/apache.conf:/etc/apache2/conf-enabled/zz-php2shell.conf:ro" \
  -v "$PWD/lab/out:/out" \
  php:8.4.26-apache
python3 exploit/php2shell_exploit.py exploit http://127.0.0.1:8088/index.php
```

The captured output is stored in `results/proof.txt`.
