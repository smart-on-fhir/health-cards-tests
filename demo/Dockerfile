FROM node:15

ENV SERVER_BASE=relative

WORKDIR /usr/src/app

COPY package.json ./
COPY src/ ./src
COPY public/ ./public
COPY private/ ./private
COPY tsconfig.json ./

RUN npm install
RUN npm run build

# Start
CMD [ "npm", "run", "deploy" ]
EXPOSE 8080
