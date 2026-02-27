FROM rust:1.85-bookworm AS builder

WORKDIR /app

# Build deps first for better layer caching.
COPY Cargo.toml Cargo.lock ./
COPY vendor ./vendor
COPY src ./src

RUN cargo build --release --locked


FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd --system --uid 10001 --create-home app

COPY --from=builder /app/target/release/quran-search-api /app/quran-search-api
COPY data /app/data

ENV PORT=7890
ENV QURAN_DATA_PATH=/app/data/quran-uthmani.json

EXPOSE 7890

USER app

CMD ["/app/quran-search-api"]

