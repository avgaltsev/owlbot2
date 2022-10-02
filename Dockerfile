FROM debian:bullseye

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update

RUN apt-get install -y curl gnupg2 lsb-release

# https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md
# RUN apt-get install -y ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

RUN apt-get install -y --fix-missing ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

RUN curl -sfL https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - && \
	sh -c 'echo "deb https://deb.nodesource.com/node_18.x `lsb_release -cs` main" >> /etc/apt/sources.list.d/nodesource.list'

RUN apt-get update && \
	apt-get install -y nodejs

WORKDIR /root/

COPY ./ ./

RUN npm config set unsafe-perm true && npm install

VOLUME /root/config/

CMD npm start
