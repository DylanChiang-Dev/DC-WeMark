# DC-WeMark 自架映像：三階段建置 → nginx 靜態服務。
# 從 repo 根目錄建置：  docker build -f deploy/Dockerfile -t dc-wemark .
#           執行：      docker run -p 8080:80 dc-wemark

# ---- 1) Rust → WASM ----
FROM rust:1-bookworm AS wasm
WORKDIR /app
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN wasm-pack build crates/wemark-core --target web --release --out-dir /app/web/src/wasm

# ---- 2) 前端建置 ----
FROM node:20-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
COPY --from=wasm /app/web/src/wasm ./src/wasm
RUN npm run build

# ---- 3) 執行期：nginx ----
FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
