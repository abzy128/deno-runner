FROM denoland/deno:2.2.7 as builder
WORKDIR /app
COPY . .
RUN deno cache src/main.ts

FROM denoland/deno:2.2.7
WORKDIR /app
COPY --from=builder /app .
CMD ["run", "--allow-net", "src/main.ts"]
