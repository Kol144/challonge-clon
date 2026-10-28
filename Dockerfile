FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js brawl-stars.js index.html tournament-bracket.js ./
COPY assets ./assets

EXPOSE 8080

CMD ["npm", "start"]
