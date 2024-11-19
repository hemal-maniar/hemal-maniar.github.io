---
layout: post
title: "OSCP Journey"
date: 2024-11-19
categories: ['OSCP']
comments: true
author: Hemal Maniar
description: This blog covers my journey through earning my Offensive Security Certified Professional (OSCP) certification and the process that went behind the scenes. 5 months of relentless efforts have helped me achieve this milestone and it's only a step in the right direction. 
meta-description: This blog covers my journey through earning my Offensive Security Certified Professional (OSCP) certification and the process that went behind the scenes. 5 months of relentless efforts have helped me achieve this milestone and it's only a step in the right direction.  
keywords: 'guide,journey,OSCP,tryharder'
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

Hello folks, in today's blog I am going to cover my journey through earning my Offensive Security Certified Professional (OSCP) certification and the process that went behind the scenes.

When I initially started out, one of the first questions I had in my head was **How long will it take to get my OSCP?**. Since it is considered one of the best in the industry for what it has to offer, as a learner you want to obtain it as quickly as possible because we know that it's a massive milestone (at least for myself) and it will help boost the chances of getting a job. 

To answer the question, I think the exam demands anywhere between 4-6 months of dedicated learning. Shorter if you've been solving boxes consistently on HackTheBox or some other platform of choice. OSCP is designed to be CTF-styled so there are quite some similarities between what goes into the process while solving boxes on other platforms. The time will surely vary based on learner's experience and time given to practice. I had laid out a plan to do it over a span of 5 months that included 90 days of OSCP course material along with labs.

### Plan


| Month | Duration | Module |
|--------|---------|---------|
| February 2024 | 1 month | OffSec Playground Play & Practice machines |
| March 2024 | 1 month | HackTheBox |
| 12th April to 12th July 2024 | 3 months | Official PEN-200 |

While the official PEN-200 coursework systematically guides learners through the entire penetration testing process, the journey leading up to that point is quite challenging. There’s no tracking of progress, and there’s nothing to help learners stay focused on the necessary skills and knowledge required for OSCP. In this case, a list of vulnerable OSCP-like machines were extremely valuable.

TJ null's list ([NetSecFocus Trophy Room](https://docs.google.com/spreadsheets/u/0/d/1dwSMIAPIam0PuRBkCiDI88pU3yzrqqHkDtBngUHNCw8/htmlview?pli=1#)) is quite well-known in the community and is regularly maintained, kept up-to-date with latest exam changes. Offers a big list for multiple training platforms in ranging difficulty levels. Some can also go beyond the scope of OSCP for better practice. It also offers list of machines for other OffSec certifications.

Another one is a hidden gem that I found via a Reddit post and is made by LainKusanagi ([Lainkusanagi OSCP list](https://docs.google.com/spreadsheets/d/18weuz_Eeynr6sXFQ87Cd5F0slOj9Z6rt/edit?gid=487240997#gid=487240997)). I have found these machines to be more in line with similarities to OSCP machines. While this is a fairly recently made, it's being constantly updated as new machines get released on HackTheBox or any other platform.

### Notes

Now that I've got the timeline out of the way, next important thing is notes. I cannot stress enough how crucial this part is through the process. Not just with respect to the exam, but just as a general rule of thumb when conducting penetration testing exercise. In a professional setting, you want to make a note of everything you see during your pentest to be included in the report.

1. Get acquainted with the note taking app of your choice. I have used multiple applications through the process so try and test to see what suits you the best that helps you organise your findings, screenshots, exploit code, etc. I'm going to link all that I've used.
- [KeepNote](https://keepnote.org/) - Simple notebook providing hierarchical organisation for all your notes and supports rich-text formatting. 
- [CherryTree](https://www.giuspen.net/cherrytree/) - Offers rich-text editing, syntax highlighting (which is great for code), and follows hierarchical approach. 
- [Obsidian](https://obsidian.md/download) - Hands down, the best I have used. Note taking in markdown format with support for code blocks, interlinking, with plugin support to customise your user flow. I always thought of myself as a poor note-taker when I saw others' work, but Obsidian has honestly made my life so much easier!

2. Next is a good application to take screenshot. Default screenshot application for Windows & Kali Linux works great but I prefer to use third-party tools that offer nifty useful features. You cannot go wrong with either but I prefer Flameshot.

- [Greenshot](https://getgreenshot.org/)
- [Flameshot](https://flameshot.org/)

### Mindset

The journey has taught me a lot; one of which includes developing the right mindset. OffSec wants the learner to build "Try Harder" mantra. They want you to be persistent, creative, and perceptive. These are key to cracking any OffSec Certifications as it teaches the learner to be patient, to trust the process, and to keep trying harder. These 5 months have been pivotal to discover flaws in my methods, fix, and surpass the hurdles. I used to make the rookie mistake of not spending time on enumerating a target, but instead jump onto the exciting part of running an exploit and gaining access to a system. But I have learnt to be patient, gather as much information as possible, rationally think about possible attack vectors before proceeding to the next stage. 

Here are a few pointers that I would like you to keep in mind as you embark on your journey.
1. Do not hesitate to **refer** to walkthroughs available online. Whenever you feel stuck, use walkthroughs to your advantage. It either,
- taught me a new approach that I did not know or,
- made me feel *stupid* for missing out on the obvious. But this was great as these realisations helped me fix my flaws!
2. Find pals to study with. I found a couple of great guys through OffSec [Discord](https://discord.com/invite/offsec) that I would speak to when I needed assistance with lab exercises. It was perfect as they would just nudge me in the right direction instead of giving me the answer. 
3. Gather resources along the way including cheatsheets, interesting payloads, exploit techniques, and **your own notes**. 
4. Try to build your own roadmap that can help you take a methodical approach.
5. Pivot, pivot, pivot! Get used to pivoting as it's going to be useful during Active Directory exercises involving different network interfaces.
6. And finally, "**Try Harder**"!

### PEN-200

I took the 90-day lab access that gave me access to course content and lab exercises for 90 days. Once I got the access, I set out a plan for myself to try & finish the coursework within the first 60 days. This includes modules and assignments provided within the modules. And 30 days for labs provided by OffSec - that includes 3 mock exam sets and 3 sets of challenge labs. The challenge labs gives you a mock scenario mimicking a small enterprise company. They provide great experience to prepare yourself before the exam! I wish to make another post about my exam experience.  

### Important Links

This is just a list of links that I have found to be important. I will also be posting a cheatsheet covering my own list of important commands that I made use of.

1. [Kashishtopi Cheatsheet](https://topi.gitbook.io/t0pitheripper)
2. [Exploit Notes](https://exploit-notes.hdks.org/)
3. [PayloadsAllTheThings](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Methodology%20and%20Resources)
4. [MSFVenom Shells](https://github.com/lexisrepo/Shells)
5. [File Transfers](https://ironhackers.es/en/cheatsheet/transferir-archivos-post-explotacion-cheatsheet/)
6. [XSS to Admin Wordpress](https://shift8web.ca/craft-xss-payload-create-admin-user-in-wordpress-user/)
7. [AD Pentest Cheatsheet](https://mayfly277.github.io/assets/blog/pentest_ad_dark.svg)
8. [Ligolo](https://software-sinner.medium.com/how-to-tunnel-and-pivot-networks-using-ligolo-ng-cf828e59e740)
9. [GitHub - cube0x0/cube0x0.github.io: Windows stuff](https://github.com/cube0x0/cube0x0.github.io)
10. [OSCP Cheatsheet by Sai Sathvik](https://s4thv1k.com/posts/oscp-cheatsheet/#lateral-movement-in-active-directory)

The journey to trying harder has been one full of multiple challenges, but I do appreciate the process I have gone through. I have learnt a lot, improved a lot, and it only makes me want to keep growing. Next step - OSWE!