#!/usr/bin/env bash
set -euo pipefail

architecture=${1:?Specify amd64 or arm64}
output=${2:?Specify the output directory}
recipe=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
inputs="$recipe/build-inputs.json"

case "$architecture:$(uname -m)" in
    amd64:x86_64|arm64:aarch64) ;;
    *) echo "A native $architecture runner is required." >&2; exit 1 ;;
esac

mkdir -p "$output"
archive="$output/compiler.tar"
builder="batchgrade-cpp-$$"
docker buildx create --name "$builder" --driver docker-container >/dev/null
trap 'docker buildx rm "$builder" >/dev/null' EXIT
docker buildx build --builder "$builder" --platform "linux/$architecture" \
    --build-arg "DEBIAN_BASE=$(jq -er .base "$inputs")" \
    --build-arg "DEBIAN_SNAPSHOT=$(jq -er .debianSnapshot "$inputs")" \
    --build-arg "SECURITY_SNAPSHOT=$(jq -er .securitySnapshot "$inputs")" \
    --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
    --provenance=false --sbom=false \
    --output "type=oci,dest=$archive,compression=gzip" "$recipe"

manifest_digest=$(tar -xOf "$archive" index.json | jq -er '.manifests | select(length == 1) | .[0].digest')
manifest=$(tar -xOf "$archive" "blobs/sha256/${manifest_digest#sha256:}")
compressed=$(jq -er '[.layers[].size] | add' <<< "$manifest")
uncompressed=0
layers=$(jq -er '.layers[] | select(.mediaType == "application/vnd.oci.image.layer.v1.tar+gzip") | .digest' <<< "$manifest")
test "$(wc -l <<< "$layers")" -eq "$(jq -er '.layers | length' <<< "$manifest")"
while read -r digest; do
    bytes=$(tar -xOf "$archive" "blobs/sha256/${digest#sha256:}" | gzip -dc | wc -c)
    uncompressed=$((uncompressed + bytes))
done <<< "$layers"
echo "linux/$architecture: $compressed compressed bytes, $uncompressed uncompressed bytes"
test "$compressed" -le $((150 * 1024 * 1024))
test "$uncompressed" -le $((450 * 1024 * 1024))

image="batchgrade-cpp-ci:$architecture"
skopeo copy "oci-archive:$archive" "docker-daemon:$image"
config_digest=$(jq -er '.config.digest' <<< "$manifest")
expected_layers=$(tar -xOf "$archive" "blobs/sha256/${config_digest#sha256:}" | jq -ec '.rootfs.diff_ids')
test "$(docker image inspect "$image" --format '{{.Architecture}}')" = "$architecture"
test "$(docker image inspect "$image" --format '{{json .RootFS.Layers}}')" = "$expected_layers"

# A trusted fixture may execute inside /tmp for CI. The desktop readiness probe uses noexec.
result=$(docker run --rm -i --pull=never --user 65534:65534 --cap-drop ALL \
    --security-opt no-new-privileges=true --network none --ipc private --cgroupns private --read-only \
    --tmpfs /tmp:rw,exec,nosuid,nodev,size=32m,mode=1777 --shm-size 8m \
    --memory 1g --memory-swap 1g --cpu-period 100000 --cpu-quota 100000 --pids-limit 64 \
    --entrypoint /usr/bin/timeout "$image" --signal=KILL 15s /bin/sh -eux -c '
        test "$(id -u)" = 65534
        grep -Eq "^NoNewPrivs:[[:space:]]+1$" /proc/self/status
        grep -Eq "^Seccomp:[[:space:]]+2$" /proc/self/status
        grep -Eq "^CapEff:[[:space:]]+0+$" /proc/self/status
        for interface in /sys/class/net/*; do
            test -f "$interface/flags" || continue
            test "${interface##*/}" != lo || continue
            flags=$(cat "$interface/flags")
            test "$((flags & 1))" -eq 0
        done
        test "$(wc -l < /proc/net/route)" -eq 1
        if touch /var/tmp/rootfs-write-test 2>/dev/null; then exit 1; fi
        test "$(cat /sys/fs/cgroup/memory.max)" = 1073741824
        test "$(cat /sys/fs/cgroup/memory.swap.max)" = 0
        test "$(cat /sys/fs/cgroup/cpu.max)" = "100000 100000"
        test "$(cat /sys/fs/cgroup/pids.max)" = 64
        /usr/bin/g++-14 -std=c++17 -O0 -Wall -Wextra -pedantic -x c++ - -o /tmp/smoke
        /tmp/smoke
    ' < "$recipe/tests/test.cpp")
test "$result" = "BatchGrade Compiler Ready"

docker run --rm --pull=never --network none --read-only --entrypoint /usr/bin/dpkg-query \
    "$image" -W -f='${binary:Package}\t${Version}\n' | LC_ALL=C sort > "$output/packages.tsv"
jq -n --arg architecture "$architecture" --arg commit "$(git rev-parse HEAD)" \
    --arg digest "$manifest_digest" --argjson compressed "$compressed" \
    --argjson uncompressed "$uncompressed" --slurpfile inputs "$inputs" \
    '{architecture: $architecture, commit: $commit, digest: $digest, compressedBytes: $compressed, uncompressedBytes: $uncompressed, inputs: $inputs[0]}' \
    > "$output/release.json"
