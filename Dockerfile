FROM node:10

RUN mkdir /src
WORKDIR /src

COPY package.json /src/package.json
COPY package-lock.json /src/package-lock.json

RUN npm ci

COPY index.js /src/index.js

EXPOSE 3000
CMD [ "npm", "start" ]
 