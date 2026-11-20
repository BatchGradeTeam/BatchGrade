# build-and-test.sh supplies the pinned Debian base. Without it the build fails.
ARG DEBIAN_BASE=scratch
FROM ${DEBIAN_BASE}

ARG DEBIAN_SNAPSHOT
ARG SECURITY_SNAPSHOT

LABEL org.opencontainers.image.source="https://github.com/BatchGradeTeam/BatchGrade"

# Slim does not ship a CA bundle. APT verifies the signed indexes and package hashes.
RUN set -eu; \
    export DEBIAN_FRONTEND=noninteractive; \
    rm -f /etc/apt/sources.list.d/debian.sources; \
    keyring=/usr/share/keyrings/debian-archive-keyring.gpg; \
    printf 'deb [signed-by=%s check-valid-until=no] http://snapshot.debian.org/archive/debian/%s/ trixie main\n' \
        "$keyring" "$DEBIAN_SNAPSHOT" > /etc/apt/sources.list; \
    printf 'deb [signed-by=%s check-valid-until=no] http://snapshot.debian.org/archive/debian-security/%s/ trixie-security main\n' \
        "$keyring" "$SECURITY_SNAPSHOT" >> /etc/apt/sources.list; \
    apt-get -o Acquire::Retries=3 update; \
    apt-get -y --no-install-recommends --with-new-pkgs upgrade; \
    apt-get -y --no-install-recommends install g++-14; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*

USER 65534:65534
CMD ["/usr/bin/g++-14", "--version"]
