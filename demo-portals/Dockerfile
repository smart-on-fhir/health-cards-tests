FROM node:15

ENV HOST_PORT=8080
ENV SERVER_BASE=http://localhost:8080/

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
