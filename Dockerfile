FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
RUN addgroup -S echoapp && adduser -S echoapp -G echoapp
COPY --from=build --chown=echoapp:echoapp /app/.next/standalone ./
COPY --from=build --chown=echoapp:echoapp /app/.next/static ./.next/static
COPY --from=build --chown=echoapp:echoapp /app/public ./public
COPY --from=build --chown=echoapp:echoapp /app/db ./db
USER echoapp
EXPOSE 3000
CMD ["node", "server.js"]
