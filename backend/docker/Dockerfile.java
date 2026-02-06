FROM alpine:3.19

RUN apk add --no-cache openjdk17-jdk coreutils
RUN adduser -D -s /bin/sh judge

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER judge
WORKDIR /tmp

ENTRYPOINT ["/entrypoint.sh"]
