FROM node:13

ENV SERVER_BASE=relative
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src
COPY dist ./dist
COPY tslint.json tsconfig.json ./
RUN npm run build-ui
RUN npm run build

# Start
CMD [ "npm", "run", "dev" ]
EXPOSE 8080
