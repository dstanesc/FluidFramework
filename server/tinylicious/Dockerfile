FROM node:16

WORKDIR /tiny

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 7070

CMD [ "node", "dist/index.js" ]
