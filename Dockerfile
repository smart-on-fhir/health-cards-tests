FROM node:13

ENV SERVER_BASE=relative
WORKDIR /usr/src/app

COPY package.json .
RUN npm install

RUN git clone https://github.com/decentralized-identity/sidetree
COPY src/ ./src
COPY tslint.json tsconfig.json ./
RUN find src
RUN npm run build-ui
RUN npm run build

# Start
CMD [ "npm", "run", "dev" ]
EXPOSE 8080
