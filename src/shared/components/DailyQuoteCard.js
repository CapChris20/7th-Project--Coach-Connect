import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import { useTheme } from '../ui/ThemeContext';

// 364 Fitness & Discipline Quotes — one per day of the year
// Usage: quotes[dayOfYear - 1]  (dayOfYear is 1-364)

const quotes = [
  // ── JANUARY (1–31) ──────────────────────────────────────────────────
  { q: "One Day or Day One.", a: "The Choice" },
  { q: "You can either suffer the pain of discipline or the pain of regret.", a: "Jim Rohn" },
  { q: "I don't count my sit-ups. I only start counting when it starts hurting, because they're the only ones that count.", a: "Muhammad Ali" },
  { q: "Today I will do what others won't, so tomorrow I can accomplish what others can't.", a: "Jerry Rice" },
  { q: "Discipline is the bridge between goals and accomplishment.", a: "Jim Rohn" },
  { q: "The real workout starts when you want to stop.", a: "Ronnie Coleman" },
  { q: "Strength does not come from physical capacity. It comes from an indomitable will.", a: "Mahatma Gandhi" },
  { q: "Once you learn to quit, it becomes a habit.", a: "Vince Lombardi" },
  { q: "If something stands between you and your success, move it. Never be denied.", a: "Dwayne Johnson" },
  { q: "You just can't beat the person who never gives up.", a: "Babe Ruth" },
  { q: "Motivation is what gets you started. Habit is what keeps you going.", a: "Jim Ryun" },
  { q: "A champion is someone who gets up when they can't.", a: "Jack Dempsey" },
  { q: "Some people want it to happen, some wish it would happen, others make it happen.", a: "Michael Jordan" },
  { q: "Confidence comes from discipline and training.", a: "Robert Kiyosaki" },
  { q: "You must expect things of yourself before you can do them.", a: "Michael Jordan" },
  { q: "Success is walking from failure to failure with no loss of enthusiasm.", a: "Winston Churchill" },
  { q: "Your mind will quit a thousand times before your body will.", a: "Unknown" },
  { q: "If you fail to prepare, you're prepared to fail.", a: "Mark Spitz" },
  { q: "Great things come from hard work and perseverance. No excuses.", a: "Kobe Bryant" },
  { q: "The body achieves what the mind believes.", a: "Napoleon Hill" },
  { q: "What hurts today makes you stronger tomorrow.", a: "Jay Cutler" },
  { q: "Get comfortable with being uncomfortable.", a: "Jillian Michaels" },
  { q: "It never gets easier. You just get better.", a: "Unknown" },
  { q: "Don't stop when you're tired. Stop when you're done.", a: "Unknown" },
  { q: "To give anything less than your best is to sacrifice the gift.", a: "Steve Prefontaine" },
  { q: "If you give up at the first sign of struggle, you're really not ready to be successful.", a: "Kevin Hart" },
  { q: "The harder the battle, the sweeter the victory.", a: "Les Brown" },
  { q: "Strength is the product of struggle. You must do what others don't to achieve what others won't.", a: "Henry Rollins" },
  { q: "All progress takes place outside the comfort zone.", a: "Michael Bobak" },
  { q: "Perseverance is the hard work you do after you get tired of doing the hard work you already did.", a: "Newt Gingrich" },
  { q: "The only bad workout is the one you didn't do.", a: "Unknown" },

  // ── FEBRUARY (32–59) ────────────────────────────────────────────────
  { q: "A year from now, you may wish you had started today.", a: "Karen Lamb" },
  { q: "You've survived 100% of your worst days.", a: "Unknown" },
  { q: "The hardest part is over. You showed up.", a: "Unknown" },
  { q: "Sweat is just fat crying.", a: "Unknown" },
  { q: "Pain is temporary. Pride is forever.", a: "Unknown" },
  { q: "Do what you have to do until you can do what you want to do.", a: "Oprah Winfrey" },
  { q: "If we could give every individual the right amount of nourishment and exercise, not too little and not too much, we would have found the safest way to health.", a: "Hippocrates" },
  { q: "Physical fitness is not only one of the most important keys to a healthy body, it is the basis of dynamic and creative intellectual activity.", a: "John F. Kennedy" },
  { q: "Action is the foundational key to all success.", a: "Pablo Picasso" },
  { q: "What does not kill me, makes me stronger.", a: "Friedrich Nietzsche" },
  { q: "Success isn't always about greatness. It's about consistency. Consistent hard work gains success. Greatness will come.", a: "Dwayne Johnson" },
  { q: "I feel an endless need to learn, to improve, to evolve — not only to please the coach and the fans — but also to feel satisfied with myself.", a: "Cristiano Ronaldo" },
  { q: "The meaning of life is not simply to exist, to survive, but to move ahead, to go up, to conquer.", a: "Arnold Schwarzenegger" },
  { q: "By improving yourself, the world is made better.", a: "Benjamin Franklin" },
  { q: "I was never a natural athlete, but I paid my dues in sweat and concentration and took the time necessary to learn.", a: "Chuck Norris" },
  { q: "Number one: like yourself. Number two: eat healthy. Number three: squeeze your buns.", a: "Richard Simmons" },
  { q: "Discipline is remembering what you want most.", a: "Unknown" },
  { q: "You don't find willpower. You create it.", a: "Unknown" },
  { q: "The time will pass anyway.", a: "Earl Nightingale" },
  { q: "Fitness isn't about vanity. It's about vitality.", a: "Jillian Michaels" },
  { q: "Fitness isn't a destination. It's a lifelong journey of self-love, self-care, and self-discovery.", a: "Katrina Scott" },
  { q: "When I feel tired, I think about how great I'll feel once I reach my goal.", a: "Michael Phelps" },
  { q: "Allow yourself the opportunity to get uncomfortable.", a: "Alex Toussaint" },
  { q: "If you don't make time for exercise, you'll probably have to make time for illness.", a: "Robin Sharma" },
  { q: "Your body won't go where your mind believes it can't.", a: "Unknown" },
  { q: "Every rep takes you closer to the strongest version of yourself.", a: "Unknown" },
  { q: "Warm up like a pro. Train like a beast. Recover like a champion.", a: "Unknown" },
  { q: "Your comfort zone is your biggest enemy in fitness.", a: "Unknown" },

  // ── MARCH (60–90) ───────────────────────────────────────────────────
  { q: "Struggles develop strength. No one builds muscle without resistance.", a: "Unknown" },
  { q: "A disciplined mindset is the foundation of every strong body.", a: "Unknown" },
  { q: "You dream. You plan. You reach. There will be obstacles. There will be doubters. There will be mistakes. But with hard work, there are no limits.", a: "Michael Phelps" },
  { q: "A goal is a wish. A standard holds you accountable.", a: "Unknown" },
  { q: "The only person you are destined to become is the person you decide to be.", a: "Ralph Waldo Emerson" },
  { q: "Always make a total effort, even when the odds are against you.", a: "Arnold Palmer" },
  { q: "Exercise should be regarded as a tribute to the heart.", a: "Gene Tunney" },
  { q: "Your health account is like a bank account. What you put in is what you get out.", a: "Unknown" },
  { q: "Just believe in yourself. Even if you don't, pretend that you do, and at some point, you will.", a: "Venus Williams" },
  { q: "Obstacles are opportunities in disguise. Embrace the challenge.", a: "Unknown" },
  { q: "The secret is to work less as individuals and more as a team. As a coach, I play not my eleven best, but my best eleven.", a: "Knute Rockne" },
  { q: "You have to push past your perceived limits, push past that point you thought was as far as you could go.", a: "Drew Brees" },
  { q: "If you don't have confidence, you'll always find a way not to win.", a: "Carl Lewis" },
  { q: "Set your goals high, and don't stop till you get there.", a: "Bo Jackson" },
  { q: "You have to expect things of yourself before you can do them.", a: "Michael Jordan" },
  { q: "In training, you listen to your body. In competition, you tell your body to shut up.", a: "Rich Froning" },
  { q: "Pain is weakness leaving the body.", a: "Unknown" },
  { q: "Tough times never last, but tough people do.", a: "Robert H. Schuller" },
  { q: "If you want something you've never had, you must be willing to do something you've never done.", a: "Thomas Jefferson" },
  { q: "The pain you feel today will be the strength you feel tomorrow.", a: "Unknown" },
  { q: "Champions keep playing until they get it right.", a: "Billie Jean King" },
  { q: "You were born to be a player. You were meant to be here. This moment is yours.", a: "Herb Brooks" },
  { q: "In every victory there is a story of struggle. In every loss there is a lesson.", a: "Unknown" },
  { q: "You can't put a limit on anything. The more you dream, the farther you get.", a: "Michael Phelps" },
  { q: "Hard work beats talent when talent doesn't work hard.", a: "Tim Notke" },
  { q: "Gold medals aren't really made of gold. They're made of sweat, determination, and a hard-to-find alloy called guts.", a: "Dan Gable" },
  { q: "It's not who's the best. It's who can handle the pressure.", a: "Unknown" },
  { q: "Mental will is a muscle that needs exercise, just like the muscles of the body.", a: "Lynn Jennings" },
  { q: "The difference between the impossible and the possible lies in a person's determination.", a: "Tommy Lasorda" },
  { q: "Never let your head hang down. Never give up and sit down and grieve.", a: "Satchel Paige" },
  { q: "The will to win is important, but the will to prepare is vital.", a: "Joe Paterno" },

  // ── APRIL (91–120) ──────────────────────────────────────────────────
  { q: "If you train hard, you'll not only be hard, you'll be hard to beat.", a: "Herschel Walker" },
  { q: "Most people give up right before the big break comes.", a: "Ross Perot" },
  { q: "I never thought about losing, but now that it's happened, the only thing is to do it right.", a: "Muhammad Ali" },
  { q: "It's not about perfect. It's about effort.", a: "Jillian Michaels" },
  { q: "I've missed more than 9000 shots in my career. I've lost almost 300 games. 26 times I've been trusted to take the game-winning shot and missed. I've failed over and over again in my life. And that is why I succeed.", a: "Michael Jordan" },
  { q: "Running is nothing more than a series of arguments between the part of your brain that wants to stop and the part that wants to keep going.", a: "Unknown" },
  { q: "Victory is in having done your best.", a: "Billy Bowerman" },
  { q: "Persistence can change failure into extraordinary achievement.", a: "Matt Biondi" },
  { q: "Continuous effort, not strength or intelligence, is the key to unlocking our potential.", a: "Winston Churchill" },
  { q: "I hated every minute of training, but I said 'Don't quit. Suffer now and live the rest of your life as a champion.'", a: "Muhammad Ali" },
  { q: "There may be people that have more talent than you, but there's no excuse for anyone to work harder than you do.", a: "Derek Jeter" },
  { q: "The difference between a successful person and others is not a lack of strength, not a lack of knowledge, but rather a lack of will.", a: "Vince Lombardi" },
  { q: "If you can dream it, you can do it.", a: "Walt Disney" },
  { q: "Make sure your worst enemy doesn't live between your own two ears.", a: "Laird Hamilton" },
  { q: "The successful warrior is the average man, with laser-like focus.", a: "Bruce Lee" },
  { q: "Do not let what you cannot do interfere with what you can do.", a: "John Wooden" },
  { q: "Don't measure yourself by what you have accomplished, but by what you should have accomplished with your ability.", a: "John Wooden" },
  { q: "One man can be a crucial ingredient on a team, but one man cannot make a team.", a: "Kareem Abdul-Jabbar" },
  { q: "Number one is just to gain a passion for running. To love the morning, to love the trail, to love the pace on the track.", a: "Pat Tyson" },
  { q: "The more difficult the victory, the greater the happiness in winning.", a: "Pelé" },
  { q: "The highest result of education is tolerance.", a: "Helen Keller" },
  { q: "To be a champion, you have to believe in yourself when nobody else will.", a: "Sugar Ray Leonard" },
  { q: "An athlete cannot run with money in his pockets. He must run with hope in his heart and dreams in his head.", a: "Emil Zatopek" },
  { q: "Most people never run far enough on their first wind to find out they've got a second.", a: "William James" },
  { q: "Push yourself because no one else is going to do it for you.", a: "Unknown" },
  { q: "Wake up with determination. Go to bed with satisfaction.", a: "Unknown" },
  { q: "Work hard in silence. Let success make the noise.", a: "Frank Ocean" },
  { q: "Your only limit is you.", a: "Unknown" },
  { q: "Dream it. Wish it. Do it.", a: "Unknown" },
  { q: "Little things make big days.", a: "Unknown" },

  // ── MAY (121–151) ───────────────────────────────────────────────────
  { q: "Be so good they can't ignore you.", a: "Steve Martin" },
  { q: "Do something today that your future self will thank you for.", a: "Unknown" },
  { q: "Fall seven times, stand up eight.", a: "Japanese Proverb" },
  { q: "I can and I will. Watch me.", a: "Unknown" },
  { q: "If it doesn't challenge you, it doesn't change you.", a: "Fred DeVito" },
  { q: "If you're tired of starting over, stop giving up.", a: "Unknown" },
  { q: "In the middle of difficulty lies opportunity.", a: "Albert Einstein" },
  { q: "Look in the mirror. That's your competition.", a: "Unknown" },
  { q: "Make it happen. Shock everyone.", a: "Unknown" },
  { q: "No pain, no gain.", a: "Unknown" },
  { q: "One day or day one. You decide.", a: "Unknown" },
  { q: "Strive for progress, not perfection.", a: "Unknown" },
  { q: "The best project you'll ever work on is you.", a: "Unknown" },
  { q: "The body achieves what the mind believes.", a: "Napoleon Hill" },
  { q: "The fight is won or lost far away from witnesses, behind the lines, in the gym, and out there on the road, long before I dance under those lights.", a: "Muhammad Ali" },
  { q: "The secret of getting ahead is getting started.", a: "Mark Twain" },
  { q: "Whether you think you can or think you can't — you're right.", a: "Henry Ford" },
  { q: "With self-discipline, most anything is possible.", a: "Theodore Roosevelt" },
  { q: "You didn't come this far to only come this far.", a: "Unknown" },
  { q: "You have to believe in yourself when no one else does. That makes you a winner right there.", a: "Venus Williams" },
  { q: "Your future is created by what you do today, not tomorrow.", a: "Robert Kiyosaki" },
  { q: "Energy and persistence conquer all things.", a: "Benjamin Franklin" },
  { q: "Every champion was once a contender that refused to give up.", a: "Rocky Balboa" },
  { q: "Excellence is not a destination but a continuous journey that never ends.", a: "Brian Tracy" },
  { q: "First say to yourself what you would be; and then do what you have to do.", a: "Epictetus" },
  { q: "Formula for success: rise early, work hard, strike oil.", a: "J. Paul Getty" },
  { q: "Genius is one percent inspiration, ninety-nine percent perspiration.", a: "Thomas Edison" },
  { q: "Go the extra mile. It's never crowded there.", a: "Unknown" },
  { q: "Hard work spotlights the character of people: some turn up their sleeves, some turn up their noses, and some don't turn up at all.", a: "Sam Ewing" },
  { q: "He who is not courageous enough to take risks will accomplish nothing in life.", a: "Muhammad Ali" },
  { q: "If you want to be the best, you have to do things that other people aren't willing to do.", a: "Michael Phelps" },

  // ── JUNE (152–181) ──────────────────────────────────────────────────
  { q: "It's not about the weight you lift; it's about the weight you carry.", a: "Unknown" },
  { q: "Knowing is not enough, we must apply. Willing is not enough, we must do.", a: "Bruce Lee" },
  { q: "Life has no limitations, except the ones you make.", a: "Les Brown" },
  { q: "Never give up on a dream just because of the time it will take to accomplish it.", a: "Earl Nightingale" },
  { q: "No matter how slow you go, you are still lapping everybody on the couch.", a: "Unknown" },
  { q: "No shortcuts. No excuses. No regrets.", a: "Unknown" },
  { q: "Pain is inevitable. Suffering is optional.", a: "Haruki Murakami" },
  { q: "Physical fitness can neither be achieved by wishful thinking nor by outright purchase.", a: "Joseph Pilates" },
  { q: "Progress is progress, no matter how small.", a: "Unknown" },
  { q: "Sacrifice something you love for something you love even more.", a: "Jillian Michaels" },
  { q: "Show up. Even on the days you don't feel like it.", a: "Unknown" },
  { q: "Small steps in the right direction can turn out to be the biggest step of your life.", a: "Unknown" },
  { q: "Success is no accident. It is hard work, perseverance, learning, studying, sacrifice, and most of all, love of what you are doing or learning to do.", a: "Pelé" },
  { q: "The body is like a machine. The more you maintain it, the longer it runs.", a: "Unknown" },
  { q: "The clock is ticking. Are you becoming the person you want to be?", a: "Greg Plitt" },
  { q: "The first wealth is health.", a: "Ralph Waldo Emerson" },
  { q: "The hard days are the best because that's when champions are made.", a: "Gabby Douglas" },
  { q: "The human body is the best picture of the human soul.", a: "Ludwig Wittgenstein" },
  { q: "The key is not the will to win, everybody has that. It is the will to prepare to win that is important.", a: "Bobby Knight" },
  { q: "The medals don't mean anything and the glory doesn't last. It's all about your happiness.", a: "Jackie Joyner-Kersee" },
  { q: "The mind is the most important part of achieving any fitness goal.", a: "Tom Venuto" },
  { q: "The road to Easy Street goes through the sewer.", a: "John Madden" },
  { q: "The successful man will profit from his mistakes and try again in a different way.", a: "Dale Carnegie" },
  { q: "There is no easy walk to freedom anywhere.", a: "Nelson Mandela" },
  { q: "There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.", a: "Ernest Hemingway" },
  { q: "Those who do not find time for exercise will have to find time for illness.", a: "Edward Stanley" },
  { q: "Time and health are two precious assets that we don't recognize and appreciate until they have been depleted.", a: "Denis Waitley" },
  { q: "Train insane or remain the same.", a: "Unknown" },
  { q: "Unless you puke, faint, or die, keep going.", a: "Jillian Michaels" },
  { q: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", a: "Aristotle" },

  // ── JULY (182–212) ──────────────────────────────────────────────────
  { q: "We must all suffer from one of two pains: the pain of discipline or the pain of regret.", a: "Jim Rohn" },
  { q: "When you feel like quitting, think about why you started.", a: "Unknown" },
  { q: "Winners never quit and quitters never win.", a: "Vince Lombardi" },
  { q: "You don't have to be great to start, but you have to start to be great.", a: "Zig Ziglar" },
  { q: "You don't get what you wish for. You get what you work for.", a: "Unknown" },
  { q: "You have within you right now, everything you need to deal with whatever the world can throw at you.", a: "Brian Tracy" },
  { q: "Your body can stand almost anything. It's your mind that you have to convince.", a: "Unknown" },
  { q: "Your health is an investment, not an expense.", a: "Unknown" },
  { q: "Your life doesn't get better by chance, it gets better by change.", a: "Jim Rohn" },
  { q: "A strong body makes the mind strong.", a: "Thomas Jefferson" },
  { q: "Action is the antidote to despair.", a: "Joan Baez" },
  { q: "Age is no barrier. It's a limitation you put on your mind.", a: "Jackie Joyner-Kersee" },
  { q: "All great achievements require time.", a: "Maya Angelou" },
  { q: "An hour of pain is worth a lifetime of glory.", a: "Unknown" },
  { q: "Be patient and tough; someday this pain will be useful to you.", a: "Ovid" },
  { q: "Believe you can and you're halfway there.", a: "Theodore Roosevelt" },
  { q: "Bite off more than you can chew, then chew it.", a: "Ella Williams" },
  { q: "Change your mind and you change your world.", a: "Norman Vincent Peale" },
  { q: "Commitment means staying loyal to what you said you were going to do long after the mood you said it in has left you.", a: "Unknown" },
  { q: "Control your own destiny or someone else will.", a: "Jack Welch" },
  { q: "Courage doesn't always roar. Sometimes courage is the quiet voice at the end of the day saying 'I will try again tomorrow.'", a: "Mary Anne Radmacher" },
  { q: "Dead last finish is greater than did not finish, which greatly trumps did not start.", a: "Unknown" },
  { q: "Defeat is not the worst of failures. Not to have tried is the true failure.", a: "George Edward Woodberry" },
  { q: "Develop success from failures. Discouragement and failure are two of the surest stepping stones to success.", a: "Dale Carnegie" },
  { q: "Determine never to be idle. No person will have occasion to complain of the want of time who never loses any.", a: "Thomas Jefferson" },
  { q: "Don't be afraid to give up the good to go for the great.", a: "John D. Rockefeller" },
  { q: "Don't limit your challenges. Challenge your limits.", a: "Unknown" },
  { q: "Don't tell me the sky's the limit when there are footprints on the moon.", a: "Unknown" },
  { q: "Don't wait for inspiration. It comes while working.", a: "Henri Matisse" },
  { q: "Each day is a chance to be better than the person you were yesterday.", a: "Unknown" },
  { q: "Earn your body.", a: "Unknown" },

  // ── AUGUST (213–243) ────────────────────────────────────────────────
  { q: "Either you run the day, or the day runs you.", a: "Jim Rohn" },
  { q: "Every accomplishment starts with the decision to try.", a: "John F. Kennedy" },
  { q: "Every day do something that will inch you closer to a better tomorrow.", a: "Doug Firebaugh" },
  { q: "Every morning you have two choices: continue to sleep with your dreams or wake up and chase them.", a: "Unknown" },
  { q: "Every strike brings me closer to the next home run.", a: "Babe Ruth" },
  { q: "Experience is simply the name we give our mistakes.", a: "Oscar Wilde" },
  { q: "Failure is success in progress.", a: "Albert Einstein" },
  { q: "Far better is it to dare mighty things, to win glorious triumphs, even though checkered by failure.", a: "Theodore Roosevelt" },
  { q: "Fear is only as deep as the mind allows.", a: "Japanese Proverb" },
  { q: "Fitness is not about being better than someone else. It's about being better than you used to be.", a: "Unknown" },
  { q: "Forget all the reasons why it won't work and believe the one reason it will.", a: "Unknown" },
  { q: "Formal education will make you a living; self-education will make you a fortune.", a: "Jim Rohn" },
  { q: "Get up. Work out. Look hot. Kick ass.", a: "Unknown" },
  { q: "Give your body the respect it deserves.", a: "Unknown" },
  { q: "Go for it now. The future is promised to no one.", a: "Wayne Dyer" },
  { q: "Good things come to those who sweat.", a: "Unknown" },
  { q: "Great works are performed not by strength but by perseverance.", a: "Samuel Johnson" },
  { q: "Habits are the invisible architecture of daily life.", a: "Gretchen Rubin" },
  { q: "He who conquers himself is the mightiest warrior.", a: "Confucius" },
  { q: "Health is not valued till sickness comes.", a: "Thomas Fuller" },
  { q: "Hustle until your haters ask if you're hiring.", a: "Unknown" },
  { q: "I am not what happened to me. I am what I choose to become.", a: "Carl Jung" },
  { q: "I can. I will. End of story.", a: "Unknown" },
  { q: "I don't run away from a challenge because I am afraid. Instead, I run toward it because the only way to escape fear is to trample it beneath your feet.", a: "Nadia Comaneci" },
  { q: "I know what I have to do and I do it. Others wish and hope. I plan and work.", a: "Unknown" },
  { q: "I train for moments that take your breath away.", a: "Unknown" },
  { q: "If it was easy, everyone would do it.", a: "Unknown" },
  { q: "If you are going through hell, keep going.", a: "Winston Churchill" },
  { q: "If you can't fly, then run. If you can't run, then walk. If you can't walk, then crawl. But whatever you do, keep moving forward.", a: "Martin Luther King Jr." },
  { q: "If you change the way you look at things, the things you look at change.", a: "Wayne Dyer" },
  { q: "If you don't like where you are, move. You are not a tree.", a: "Unknown" },

  // ── SEPTEMBER (244–273) ─────────────────────────────────────────────
  { q: "If you don't make mistakes, you're not working on hard enough problems.", a: "Frank Wilczek" },
  { q: "If you look at what you have in life, you'll always have more.", a: "Oprah Winfrey" },
  { q: "If you want to change your life, change your daily habits.", a: "Unknown" },
  { q: "In any moment of decision, the best thing you can do is the right thing.", a: "Theodore Roosevelt" },
  { q: "Iron rusts from disuse; water loses its purity from stagnation. Even so does inaction sap the vigor of the mind.", a: "Leonardo da Vinci" },
  { q: "It's not whether you get knocked down; it's whether you get up.", a: "Vince Lombardi" },
  { q: "It's not how big you are; it's how big you play.", a: "Unknown" },
  { q: "It's supposed to be hard. If it wasn't hard, everyone would do it. The hard is what makes it great.", a: "Tom Hanks" },
  { q: "Keep going. Everything you need will come to you at the right time.", a: "Unknown" },
  { q: "Know your limits, then defy them.", a: "Unknown" },
  { q: "Learn the rules like a pro, so you can break them like an artist.", a: "Pablo Picasso" },
  { q: "Let your performance do the thinking.", a: "Charlotte Brontë" },
  { q: "Life is either a daring adventure or nothing at all.", a: "Helen Keller" },
  { q: "Look in the mirror every day and tell yourself: I am a champion.", a: "Unknown" },
  { q: "Make each day your masterpiece.", a: "John Wooden" },
  { q: "Make the most of yourself, for that is all there is of you.", a: "Ralph Waldo Emerson" },
  { q: "Mastery is not something that strikes in an instant, like a thunderbolt, but a gathering power that moves steadily through time, like weather.", a: "John Gardner" },
  { q: "Move your body like your life depends on it. Because it does.", a: "Unknown" },
  { q: "Never let your fear decide your future.", a: "Unknown" },
  { q: "No guts, no glory. No brain, same story.", a: "Unknown" },
  { q: "Nobody who ever gave their best regretted it.", a: "George Halas" },
  { q: "Nothing will work unless you do.", a: "Maya Angelou" },
  { q: "Once you stop learning, you start dying.", a: "Albert Einstein" },
  { q: "Only the disciplined ones in life are free.", a: "Eliud Kipchoge" },
  { q: "Optimism is the faith that leads to achievement.", a: "Helen Keller" },
  { q: "Our greatest glory is not in never falling, but in rising every time we fall.", a: "Confucius" },
  { q: "Out of difficulties grow miracles.", a: "Jean de la Bruyère" },
  { q: "Pain is just weakness leaving the body.", a: "Unknown" },
  { q: "People who are crazy enough to think they can change the world are the ones who do.", a: "Rob Siltanen" },
  { q: "Press on. Nothing in the world can take the place of persistence.", a: "Calvin Coolidge" },

  // ── OCTOBER (274–304) ───────────────────────────────────────────────
  { q: "Pressure is a privilege. It only comes to those who earn it.", a: "Billie Jean King" },
  { q: "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort.", a: "Paul J. Meyer" },
  { q: "Pursue what catches your heart, not what catches your eyes.", a: "Roy T. Bennett" },
  { q: "Quality is not an act, it is a habit.", a: "Aristotle" },
  { q: "Real change, enduring change, happens one step at a time.", a: "Ruth Bader Ginsburg" },
  { q: "Refuse to be average. Let your heart soar as high as it will.", a: "A.W. Tozer" },
  { q: "Results happen over time, not overnight. Work hard, stay consistent, and be patient.", a: "Unknown" },
  { q: "Risk more than others think is safe. Dream more than others think is practical.", a: "Howard Schultz" },
  { q: "Scars are just another kind of strength.", a: "Unknown" },
  { q: "See it. Believe it. Achieve it.", a: "Unknown" },
  { q: "Self-discipline is the magic power that makes you virtually unstoppable.", a: "Dan Kennedy" },
  { q: "Setting goals is the first step in turning the invisible into the visible.", a: "Tony Robbins" },
  { q: "Some people dream of success while others wake up and work hard at it.", a: "Unknown" },
  { q: "Start where you are. Use what you have. Do what you can.", a: "Arthur Ashe" },
  { q: "Stay positive, work hard, make it happen.", a: "Unknown" },
  { q: "Stop making excuses. Start making progress.", a: "Unknown" },
  { q: "Strength comes from struggle. When you learn to see your struggles as opportunities to become stronger, better, wiser, then your thinking shifts.", a: "Toni Sorenson" },
  { q: "Success is found in your daily routine.", a: "Unknown" },
  { q: "Success is not for the lazy.", a: "Unknown" },
  { q: "Success is the sum of small efforts, repeated day in day out.", a: "Robert Collier" },
  { q: "Take care of your body. It's the only place you have to live.", a: "Jim Rohn" },
  { q: "The chains of habit are too light to be felt until they are too heavy to be broken.", a: "Warren Buffett" },
  { q: "The difference between try and triumph is just a little umph.", a: "Marvin Phillips" },
  { q: "The expert in anything was once a beginner.", a: "Helen Hayes" },
  { q: "The future belongs to those who believe in the beauty of their dreams.", a: "Eleanor Roosevelt" },
  { q: "The greatest victory is the one over yourself.", a: "Unknown" },
  { q: "The harder you work for something, the greater you'll feel when you achieve it.", a: "Unknown" },
  { q: "The only place where success comes before work is in the dictionary.", a: "Vidal Sassoon" },
  { q: "The pain you feel today is the strength you will feel tomorrow.", a: "Unknown" },
  { q: "The principle is competing against yourself. It's about self-improvement, about being better than you were the day before.", a: "Steve Young" },
  { q: "The secret to getting results is to make the process the goal, not the outcome.", a: "James Clear" },

  // ── NOVEMBER (305–334) ──────────────────────────────────────────────
  { q: "The struggle you're in today is developing the strength you need for tomorrow.", a: "Unknown" },
  { q: "The successful man has the habit of doing things failures don't like to do.", a: "E.M. Gray" },
  { q: "The sweat you drip today is the trophy you hold tomorrow.", a: "Unknown" },
  { q: "The tougher the conditions, the tougher the competitor.", a: "Unknown" },
  { q: "The way to get started is to quit talking and begin doing.", a: "Walt Disney" },
  { q: "The world is not fair, and often fools, cowards, liars and the selfish hide in high places. But mostly the world is what we make it, and a man can make a lot of difference.", a: "Louis L'Amour" },
  { q: "There is no substitute for hard work.", a: "Thomas Edison" },
  { q: "Think big thoughts but relish small pleasures.", a: "H. Jackson Brown Jr." },
  { q: "To succeed in life, you need two things: ignorance and confidence.", a: "Mark Twain" },
  { q: "To win without risk is to triumph without glory.", a: "Pierre Corneille" },
  { q: "Today is the first day of the rest of your life.", a: "Unknown" },
  { q: "Train your mind to see the good in every situation.", a: "Unknown" },
  { q: "Transformation is a process, and as life happens there are tons of ups and downs.", a: "Rick Warren" },
  { q: "Trying to be better than yourself is enough. Stop comparing yourself to others.", a: "William Faulkner" },
  { q: "Turn your wounds into wisdom.", a: "Oprah Winfrey" },
  { q: "Two things define you. Your patience when you have nothing and your attitude when you have everything.", a: "Unknown" },
  { q: "Use what you have. Run with what you've got.", a: "Unknown" },
  { q: "Victory comes to those who make the least mistakes.", a: "Unknown" },
  { q: "Walk away from anything that gives you bad vibes. There is no need to explain or make sense of it. It's your life. Do what makes you happy.", a: "Unknown" },
  { q: "Well done is better than well said.", a: "Benjamin Franklin" },
  { q: "What you lack in talent can be made up with desire, hustle, and giving 110% all the time.", a: "Don Zimmer" },
  { q: "Whatever you are, be a good one.", a: "Abraham Lincoln" },
  { q: "When life gets harder, challenge yourself to be stronger.", a: "Unknown" },
  { q: "When you feel like giving up, remember why you held on so long in the first place.", a: "Unknown" },
  { q: "Without self-discipline, success is impossible, period.", a: "Lou Holtz" },
  { q: "Work like there is someone working 24 hours a day to take it all away from you.", a: "Mark Cuban" },
  { q: "You are one workout away from a good mood.", a: "Unknown" },
  { q: "You can have results or excuses. Not both.", a: "Arnold Schwarzenegger" },
  { q: "You don't always get what you wish for. You get what you work for.", a: "Unknown" },
  { q: "You have to be at your strongest when you're feeling at your weakest.", a: "Unknown" },

  // ── DECEMBER (335–364) ──────────────────────────────────────────────
  { q: "You have to earn your body.", a: "Greg Plitt" },
  { q: "You just have to keep pushing. You have to keep fighting through the pain, through the adversity.", a: "Tom Brady" },
  { q: "You might be the underdog, but you can still bite.", a: "Unknown" },
  { q: "You owe it to yourself to be the best person you can possibly be.", a: "Unknown" },
  { q: "You're already in pain. Get a reward from it.", a: "Greg Plitt" },
  { q: "Your body is your most priceless possession. Take care of it.", a: "Jack LaLanne" },
  { q: "Your excuses are just the lies your fears have sold you.", a: "Robin Sharma" },
  { q: "Your mind will always believe everything you tell it. Feed it hope. Feed it truth. Feed it with love.", a: "Unknown" },
  { q: "Your past does not determine who you are. Your past prepares you for who you are to become.", a: "Joel Osteen" },
  { q: "Zero is not failure. Giving up is failure.", a: "Unknown" },
  { q: "Act as if what you do makes a difference. It does.", a: "William James" },
  { q: "Be stronger than your strongest excuse.", a: "Unknown" },
  { q: "Burn fat, not daylight.", a: "Unknown" },
  { q: "Crave results, not comfort.", a: "Unknown" },
  { q: "Discipline is choosing between what you want now and what you want most.", a: "Abraham Lincoln" },
  { q: "Don't count the days. Make the days count.", a: "Muhammad Ali" },
  { q: "Don't wish it were easier. Wish you were better.", a: "Jim Rohn" },
  { q: "Every day is another chance to get stronger, to eat better, to live healthier.", a: "Unknown" },
  { q: "Every pound of muscle is earned, not given.", a: "Unknown" },
  { q: "Fit is not a destination. It is a way of life.", a: "Unknown" },
  { q: "Go hard or go home.", a: "Unknown" },
  { q: "Hustle for that muscle.", a: "Unknown" },
  { q: "I don't stop when I'm tired. I stop when I'm done.", a: "David Goggins" },
  { q: "If you want it bad enough, you'll find a way. If not, you'll find an excuse.", a: "Unknown" },
  { q: "Lift heavy. Think light.", a: "Unknown" },
  { q: "No zero days. Period.", a: "Unknown" },
  { q: "Pain is the price of progress.", a: "Unknown" },
  { q: "Respect the grind.", a: "Unknown" },
  { q: "Rise above it. Every. Single. Day.", a: "Unknown" },
  { q: "The gym is not a hobby. It is a lifestyle.", a: "Unknown" },
];

// Helper: get today's quote based on day of year
const getTodayQuote = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay); // 1–365
  const index = (dayOfYear - 1) % quotes.length;
  return quotes[index];
};

// Helper: get random quote (for refresh button)
const getRandomQuote = () => {
  return quotes[Math.floor(Math.random() * quotes.length)];
};

function withAlpha(hex, alpha) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const ACCENT = '#7C3AED';

async function getCreatedAtMillisFromFirestore(userId) {
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) return null;
  const data = userDoc.data();
  const createdAt = data?.createdAt;

  if (!createdAt) return null;
  if (typeof createdAt?.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt === 'number') return createdAt;

  const asDate = new Date(createdAt);
  const ms = asDate.getTime();
  return Number.isFinite(ms) ? ms : null;
}

export default function DailyQuoteCard({ userId, cardWidth, cardMinHeight, embedded = false }) {
  const { colors, isDark } = useTheme();
  const outerWidth = cardWidth ?? '100%';
  const outerMinHeight = cardMinHeight ?? 96;

  const [quoteIndex, setQuoteIndex] = useState(0);

  // High-contrast typography; when embedded, let the parent handle border/background.
  const cardBg = embedded
    ? 'transparent'
    : (isDark ? 'rgba(10,10,15,0.78)' : 'rgba(255,255,255,0.92)');
  const borderColor = embedded
    ? 'transparent'
    : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.10)');
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const authorColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.70)';

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId) return;

      try {
        const cachedIndexRaw = await AsyncStorage.getItem('currentQuoteIndex');
        if (!cancelled && cachedIndexRaw != null) {
          const cachedIndex = Number(cachedIndexRaw);
          if (Number.isFinite(cachedIndex) && cachedIndex >= 0 && cachedIndex < quotes.length) {
            setQuoteIndex(cachedIndex);
          }
        }

        const hasSeenFirstQuote = await AsyncStorage.getItem('hasSeenFirstQuote');
        if (!hasSeenFirstQuote) {
          // Show "One day or day one" as the very first quote for new accounts
          const firstQuoteIndex = quotes.findIndex(q => q.q === "One day or day one. You decide.");
          if (!cancelled && firstQuoteIndex !== -1) {
            setQuoteIndex(firstQuoteIndex);
          }
          await AsyncStorage.setItem('hasSeenFirstQuote', 'true');
          await AsyncStorage.setItem('currentQuoteIndex', String(firstQuoteIndex));
          return;
        }

        let createdAtMillis = null;

        const cachedCreatedAt = await AsyncStorage.getItem('userCreatedAt');
        if (cachedCreatedAt) {
          const ms = Number(cachedCreatedAt);
          if (Number.isFinite(ms) && ms > 0) createdAtMillis = ms;
        }

        if (createdAtMillis == null) {
          try {
            createdAtMillis = await getCreatedAtMillisFromFirestore(userId);
            if (createdAtMillis != null) {
              await AsyncStorage.setItem('userCreatedAt', String(createdAtMillis));
            }
          } catch (e) {
            // Firestore slow/unavailable; keep createdAtMillis null
          }
        }

        if (createdAtMillis == null) {
          // If we cannot resolve createdAt, keep whatever we have cached / default
          return;
        }

        const hoursSinceSignup = (Date.now() - createdAtMillis) / 3600000;
        const daysSinceSignup = Math.floor(hoursSinceSignup / 24);
        // For new accounts (less than 24 hours), always show the first quote (index 0)
        const index = daysSinceSignup === 0 ? 0 : daysSinceSignup % quotes.length;

        if (!cancelled) setQuoteIndex(index);
        await AsyncStorage.setItem('currentQuoteIndex', String(index));
      } catch (e) {
        // If AsyncStorage fails, do nothing and keep default
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const quote = quotes[quoteIndex] || quotes[0];

  // Refresh to a random quote on tap
  
  return (
    <View style={[styles.outer, { width: outerWidth, minHeight: outerMinHeight }]}>
      <View style={[styles.border, { borderColor, borderWidth: embedded ? 0 : 1 }]}>
        <View style={[styles.card, { backgroundColor: cardBg, minHeight: outerMinHeight }]}>
          <View style={styles.content}>
            <Text style={[styles.quoteText, { color: textColor }]}>
              "{quote.q}"
            </Text>
            <Text style={styles.inspirationLabel}>DAILY INSPIRATION</Text>
            <Text style={[styles.authorText, { color: authorColor }]}>
              — {quote.a ? quote.a : 'Daily Motivation'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function DailyQuotePill({ userId, isDarkOverride, maxLines = 4 }) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkOverride === 'boolean' ? isDarkOverride : themeIsDark;

  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) return;
      try {
        const cachedIndexRaw = await AsyncStorage.getItem('currentQuoteIndex');
        if (!cancelled && cachedIndexRaw != null) {
          const cachedIndex = Number(cachedIndexRaw);
          if (Number.isFinite(cachedIndex) && cachedIndex >= 0 && cachedIndex < quotes.length) {
            setQuoteIndex(cachedIndex);
          }
        }
      } catch (_) {
        // ignore
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const quote = quotes[quoteIndex] || quotes[0];

  return (
    <View style={pillStyles.wrap}>
      <View
        style={[
          pillStyles.inner,
          {
            // More opaque fill so the border gradient doesn't tint the pill.
            backgroundColor: isDark ? 'rgba(10,10,15,0.80)' : 'rgba(255,255,255,0.92)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)',
          },
        ]}
      >
        <Text
          style={[pillStyles.text, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}
          numberOfLines={maxLines}
          ellipsizeMode="tail"
        >
          "{quote.q}"
        </Text>
        <Text
          style={[pillStyles.author, { color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)' }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          — {quote.a ? quote.a : 'Unknown'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 260,
    minHeight: 120,
  },
  border: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 96,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  quoteText: {
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  inspirationLabel: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FF6B9D',
  },
  authorText: {
    marginTop: 4,
    textAlign: 'left',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});

const pillStyles = StyleSheet.create({
  wrap: {
    // Parent controls width/maxWidth; keep pill full-width inside gradient border.
    width: '100%',
    alignSelf: 'center',
    borderRadius: 28,
    overflow: 'hidden',
  },
  inner: {
    borderRadius: 26,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  author: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
