FROM postgres:17-alpine
RUN apk add --no-cache coreutils
COPY --chmod=755 backup.sh /usr/local/bin/backup
HEALTHCHECK --interval=10m CMD ["backup", "check"]
ENTRYPOINT ["backup"]
