---
title: 'How to and why seed on E-Hentai'
description: 'Intro 3 currency of E-Hentai and seeding method'
pubDate: 'Apr 16 2024'
updatedDate: 'Oct 2 2024'
heroImageId: '3f37a35a-06f7-44f4-ecca-b2a3d5a6b700'
tags:
  - E-Hentai
  - homelab
pinned: true
---

## What is E-Hentai

E-Hentai is one of the most successful decentralised project. It beats Filecoin, IPFS and other random nobody-using web3 projects in terms of bandwidth, storage, traffic, user count and community activity. 

Just kidding, everyone reading this article knows what E-Hentai is.

E-Hentai has two sites: the external site and the inner site. The external site has ads and stricter content review, while the inner site has no ads and richer content. Both of them are restricted by DMCA, so you may find some content missing. (Maybe you can search some asian sites to find the missing content? Small asian sites may not be found by copyright holders.)

External site domain: [e-hentai.org](https://e-hentai.org/)

Inner site domain: [exhentai.org](https://exhentai.org/)

[EHViewer](https://github.com/FooIbar/EhViewer) is recommended. It is an android client that can help you avoid ads and provide a better experience.

## About the inner site

To access inner site, an authorized account is required. You need to register an account on the forum, and pass the review after a period of time. The inner site has IP restrictions, so if you can't access it, try switching to a European or American IP. EHViewer guarantees that you can access the inner site even if you switch IP after successfully opening it once.

The process of inner site authentication is:

1. Login at the forum to get a cookie. This cookie is shared between the external and inner sites.
2. The cookie has four fields: `igneous`, `ipb_member_id`, `ipb_pass_hash`, `sk`. The external site gets the last three fields.
3. Once accessing the inner site, get the `igneous` field. The inner site requires these 4 valid fields. If the `igneous` field is `mystery`, you may need to check the network environment.

If you are a new user, it is recommended to keep a consistent European or American IP and not rush to access the inner site. You will be able to access it in a few days.

If you can't access the inner site correctly, you will see a sad panda or just white blank.

## Currency in E-Hentai

In short, E-Hentai has three currencies:

- [Gallery Points](https://ehwiki.org/wiki/Gallery_Points) (GP): Currency used when downloading images
- [Credit Points](https://ehwiki.org/wiki/Credits) (CP): Circulating points, can be transferred, purchased with GP or Hath
- [Hath](https://ehwiki.org/wiki/Hath): High value, the most powerful currency

### Gallery Points

GP is mainly used when downloading images. Generally, you only need to use GP and don't need to use the other two (unless you have a large amount of usage).

Uses of GP:

1. **When Credit is insufficient**, download **high-resolution** image sets consumes GP (the higher the resolution, the more GP consumed)
2. Refresh browsing quota (default limit 5000, 3 per minute, can be refreshed with GP)
3. Purchase Credit and Hath

Ways to get GP:

1. Seed with H@H
2. Purchase with CP or Hath
3. Upload image sets (get GP when clicked)
4. Seeding with bittorrent
5. Donate

Generally you can get enough GP by seeding with H@H. We will talk about that soon.

### Credit Points

CP is mainly used for trading. You can buy GP or Hath with CP.

Uses of CP:

1. Download high-resolution image sets (the higher the resolution, the more CP consumed)
2. Purchase GP or Hath
3. Transfer to other users

Ways to get CP:

1. Purchase with GP
2. Donate
3. Upload the image sets (get CP when others downloads high-resolution version)
4. Complete the Quests
5. Receive from other users

### Hath

Hath is the most valuable currency in E-Hentai. It is used for advanced functions.

Ways to get Hath:

1. Purchase with CP or GP
2. Seed with H@H
3. Have a Silver or higher donation level

Uses of Hath:

1. **Unlock advanced functions** (such as removing ad, show more images in a page, etc.)
2. Purchase CP

## Seeding with H@H

About the H@H, please refer to the [Hentai@Home Wiki](https://ehwiki.org/wiki/Hentai@Home) page.

As I said above, seeding with H@H can get Hath, GP, Moderation Power and free download traffic. Free traffic can help you save some GP or CP.

In [status page](https://e-hentai.org/hentaiathome.php), you can see the status of H@H service in the world.

### Apply for H@H Seed

You need to apply to join H@H. The application page is [here](https://e-hentai.org/hentaiathome_apply.php).

Requirements of applying:

- as least 80Mbps outbound bandwidth (use [speedtest-cli](https://www.speedtest.net/apps/cli) to prove)
- as least 10Gib free space
- keep server online

In my case, I use my bare metal server who has 1Gbps bandwidth and 1T free space for seeding. I applied with 950Mbps bandwidth and attached the speedtest-cli result, then I got approved after a few hours.

After you get approved, you will get a token. You can use this token to seed with H@H. The token is on [H@H page](https://e-hentai.org/hentaiathome.php).

### Configure the H@H client

I assume you are using Debian (or other Debian distros), if you are using other Linux distros, you need to change some commands. ~I use NixOS btw.~

> You say you are using Windows as server? Get outta here.

Download JRE or JDK from [Oracle](https://www.oracle.com/java/technologies/downloads/). I use JDK.

```bash
wget -c https://download.oracle.com/java/22/latest/jdk-22_linux-x64_bin.deb
sudo apt install ./jdk-22_linux-x64_bin.deb
```

> **DO NOT COPY COMMANDS BLINDLY! THE LINK MAY BE OUTDATED. PLEASE MANUALLY FIND THE LATEST LINK.**

Then, download the jar client at [H@H page](https://e-hentai.org/hentaiathome.php).

```bash
wget -c https://repo.e-hentai.org/hath/HentaiAtHome_1.6.2.zip
unzip HentaiAtHome_1.6.2.zip
```

You need to run it at first time to key in necessary data, then put it in systemctl.

```bash
cd HentaiAtHome_1.6.2
java -jar HentaiAtHome.jar
```

Configure the `hentai_at_home.service` **like** this

> **Do not copy blindly!** You need to change the path and user.
> 
> use `:wq` to save and exit in vim. If permission denied, use `:q!` to exit and use `sudo vim`. Or use `nano` instead.

```ini
[Unit]
Description=Hentai@Home
After=network.target

[Service]
Type=simple
User=your_user  # ensure you have permission to write cache
Group=your_group
Restart=always
WorkingDirectory=/path/to/HentaiAtHome_1.6.2
ExecStart=/usr/bin/java -jar /path/to/HentaiAtHome_1.6.2/HentaiAtHome.jar

[Install]
WantedBy=multi-user.target
```

Then enable auto start and start the service.

```bash
sudo systemctl enable hentai_at_home
sudo systemctl start hentai_at_home
```