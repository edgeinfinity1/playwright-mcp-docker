FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        curl \
        fonts-liberation \
        fonts-noto-cjk \
        gosu \
        novnc \
        openbox \
        socat \
        websockify \
        x11vnc \
        xvfb \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash browser \
    && ln -sf vnc.html /usr/share/novnc/index.html

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/browser-entrypoint

RUN chmod +x /usr/local/bin/browser-entrypoint \
    && mkdir -p /data/chromium \
    && chown -R browser:browser /data/chromium

EXPOSE 6080 9223

ENTRYPOINT ["browser-entrypoint"]
