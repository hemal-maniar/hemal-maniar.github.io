// Gets the current year for footer
var date = new Date();
var currentYear = date.getFullYear();
document.getElementById("date").innerHTML = "2024 -  " + currentYear + " | Hemal Maniar";

// Sticky navigation bar
window.onscroll = function () { myFunction() };

var navbar = document.getElementById("navbar");
var sticky = navbar.offsetTop;

function myFunction() {
    // make sticky
    if (window.pageYOffset >= sticky) {
        navbar.classList.add("sticky")
        navbar.classList.add("border-bottom")

    } else {
        navbar.classList.remove("sticky")
        navbar.classList.remove("border-bottom")
    }
}

// Subheading terminal effect
consoleText(['a Security Engineer', 'a Penetration Tester', 'a Cybersecurity Analyst', 'a Blogger', 'OSCP Certified'], 'text', ['#34e408']);
consoleText(['hemal:-$ whoami'], 'whoami',['#33ff00']);

function consoleText(words, id, colors) {
    if (colors === undefined) colors = ['#2e3141'];
    var visible = true;
    var con = document.getElementById('console');
    var letterCount = 1;
    var x = 1;
    var waiting = false;
    var target = document.getElementById(id)
    target.setAttribute('style', 'color:' + colors[0])
    window.setInterval(function () {

        if (letterCount === 0 && waiting === false) {
            waiting = true;
            target.innerHTML = words[0].substring(0, letterCount)
            window.setTimeout(function () {
                var usedColor = colors.shift();
                colors.push(usedColor);
                var usedWord = words.shift();
                words.push(usedWord);
                x = 1;
                target.setAttribute('style', 'color:' + colors[0])
                letterCount += x;
                waiting = false;
            }, 1000)
        } else if (letterCount === words[0].length + 1 && waiting === false) {
            waiting = true;
            window.setTimeout(function () {
                x = -1;
                letterCount += x;
                waiting = false;
            }, 1000)
        } else if (waiting === false) {
            target.innerHTML = words[0].substring(0, letterCount)
            letterCount += x;
        }
    }, 30) //default: 120
}

// Navbar active link
$(document).ready(function () {
    $('#navbar a').on("click", function () {
        $(this).parent().siblings().find("a").removeClass('active');
        $(this).addClass('active');
    });
});
