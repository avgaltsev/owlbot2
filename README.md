```bash
docker build -t avgaltsev/owlbot:0.0.0 ./
```

Create Azure VM using "Standard A2m v2" instance type

Install XFCE and XRDP

```bash
sudo apt-get install xfce4
sudo apt-get install xrdp
```

Create a new user for XRDP (the default one cannot login probably for security reasons)

```bash
sudo adduser avgaltsev2
```

Install Google Chrome

Login via RDP and start Chrome instances

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=... --remote-debugging-port=9222
```

```bash
google-chrome-unstable --user-data-dir=/home/avgaltsev2/profile1 --remote-debugging-port=9222
google-chrome-unstable --user-data-dir=/home/avgaltsev2/profile2 --remote-debugging-port=9223
```

Copy tokens from the output

Create owlbot config and add Chrome connection entries

```bash
docker volume create owlbot-config
```

Copy `src/config/config.example.json` as `config.json` to the volume `owlbot-config` and edit it.

Start container

```bash
docker run -d --name owlbot --restart always --net=host -v owlbot-config:/root/config/ avgaltsev/owlbot:0.0.0
```

Updating config

```bash
sudo nano /var/lib/docker/volumes/owlbot-config/_data/config.json
docker restart owlbot
```

Overwatch League YouTube Channel:
https://www.youtube.com/channel/UCiAInBL9kUzz1XRxk66v-gw
