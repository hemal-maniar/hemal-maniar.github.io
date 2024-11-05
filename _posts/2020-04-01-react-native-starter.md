---
layout: post
title: "Cicada HackTheBox"
date: 2024-10-11
categories: ['HackTheBox','Walkthrough']
tags: ['hackthebox','walkthrough','Cicada','OSCP']
comments: true
author: Benjamin Carlson
description: React Native is a JavaScript framework for building cross platform mobile apps. In this tutorial I'll show you how to quickly set up a React Native project and
meta-description: In this beginner react native tutorial we will learn how to get your first app up and running quickly.
keywords: 'react native, beginner react native'
img: /assets/img/posts/11-react-native-quickstart/react-native.png
alt: React Native
---

## Introduction

React Native is a JavaScript framework for building cross platform mobile apps. In this tutorial I'll show you how to quickly set up a React Native project and run your app on your actual device! The code for this tutorial can be found on my [GitHub](https://github.com/bjcarlson42/blog-post-code/tree/master/Quickstart%20React%20Native/ExampleProject){:target="_blank"}.

{% include under-p1-ad.html %}

## Expo

In this tutorial, we will be using expo with React Native. Expo acts as a container around the React Native framework that allows us to develop applications more quickly and easily compared to if we were using bare bones React Native. The first thing we need to do is install the Expo CLI command line utility. Open your terminal and run the following command:

<pre class="ir is it iu iv lh li fg">
    <span class="lj jl ap bh lk b by ll lm r ln">
    npm install -g expo-cli
    </span>
</pre>

Now we can create a new React Native project. I will call my project ExampleProject but you can call it whatever you like.

<pre class="ir is it iu iv lh li fg">
    <span class="lj jl ap bh lk b by ll lm r ln">
    expo init ExampleProject
    </span>
</pre>

Expo will prompt you with the following message:

<span class="blog-post-imbedded-img">
![]({{ site.url }}/assets/img/posts/11-react-native-quickstart/1.png)
</span>

For this tutorial, I will select blank but I encourage you to do some research and select the best option for your project.

## Running Our App

Believe it or not, our app is ready to be run! To start our app we must move into the folder which contains our app and then run the start command.

<pre class="ir is it iu iv lh li fg">
    <span class="lj jl ap bh lk b by ll lm r ln">
    cd AwesomeProject
    npm start
    </span>
</pre>

When you run 'npm start', a new browser window will open at your local host. You will notice a barcode in the lower left hand corner. 

<span class="blog-post-imbedded-img">
![]({{ site.url }}/assets/img/posts/11-react-native-quickstart/expo-browser.png) 
</span>

We can scan this barcode in the expo app to run our app on a device. Go to either the Apple App Store or the Google Play Store and search for 'expo client'. See the image below. 

<span class="blog-post-imbedded-img">
![]({{ site.url }}/assets/img/posts/11-react-native-quickstart/2.png)
</span>

Once you download and open the app, you will see an option to "Scan QR Code". Tap this and scan your code. After the JavaScript loads, you should be able to see the app on your device. If you see "Open up App.js to start working on your app!" you have done it correctly.

## Conclusion

Now go out and start building the app of your dreams! If you want the exact code I used in this tutorial, it can be found on my [GitHub](https://github.com/bjcarlson42/blog-website-code/tree/master/Quickstart%20React%20Native/ExampleProject){:target="_blank"}. Happy coding!
