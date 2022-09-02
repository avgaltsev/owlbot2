```bash
docker build -t avgaltsev/owlbot2:0.0.0 ./
```

Create Azure VM using "Standard A2m v2" instance type.

Install XFCE and XRDP.

```bash
sudo apt-get install xfce4
sudo apt-get install xrdp
```

Create a new user for XRDP (the default one cannot login probably for security reasons).

```bash
sudo adduser avgaltsev2
```

Install Google Chrome.

Login via RDP, start Chrome instances and login with a Blizzard connected account.

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=... --remote-debugging-port=9222
```

```bash
google-chrome-unstable --user-data-dir=/home/avgaltsev2/profile1 --remote-debugging-port=9222
google-chrome-unstable --user-data-dir=/home/avgaltsev2/profile2 --remote-debugging-port=9223
```

Copy tokens from the output.

Create owlbot2 config and add Chrome connection entries.

```bash
docker volume create owlbot2-config
```

Copy `src/json/default-config.json` to `config.json` inside the volume `owlbot2-config` and edit it.

Start the container.

```bash
docker run -d --name=owlbot2 --restart=unless-stopped --net=host -v owlbot2-config:/root/config/ avgaltsev/owlbot2:0.0.0
```

Updating config.

```bash
sudo nano /var/lib/docker/volumes/owlbot2-config/_data/config.json
docker restart owlbot2
```

Overwatch League YouTube Channel:
https://www.youtube.com/c/overwatchleague
