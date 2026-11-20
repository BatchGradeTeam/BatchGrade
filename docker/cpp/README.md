# BatchGrade C++ compiler image

The image contains Debian stable and the packages required to compile and link C++17 with `g++-14`. BatchGrade selects a published Linux AMD64 or ARM64 manifest by digest from `image-digests.json`. Docker Desktop must use Linux containers on Windows and macOS. Docker Engine on Linux must report CPU, memory, swap, and PID limits and the default seccomp profile. Rootless engines with missing cgroup controls are unsupported.

## First release and security updates

1. Review [Debian advisories](https://www.debian.org/security/) and the [Debian Security Tracker](https://security-tracker.debian.org/tracker/) against the package inventories from the last compiler workflow. Use Debian's fixed package version for `trixie`, including its revision.
2. Update the base digest and the applicable Debian and Debian Security timestamps in `build-inputs.json`. Choose timestamps that include the fixes. The image build checks APT signatures. The snapshot sources allow expired index dates so that previously reviewed inputs remain buildable.
3. Let the C++ compiler workflow build and test both architectures on the pull request. Inspect its `compiler-record-*` artifacts for the resolved package versions, source commit, image digests, and sizes. Confirm that the inventory contains the required Debian patches. The compressed and uncompressed layer limits are 150 MiB and 450 MiB per architecture.
4. After merging to `v2`, create a lightweight tag such as `cpp-compiler-v1.0.0` on the reviewed `v2` commit and push that tag. A release tag triggers the workflow from `v2` even while `main` is the default branch. The publish job uses the exact OCI archives verified by the native build jobs. For the initial release, an organization maintainer must allow the repository workflow to publish and make the package public in GHCR. If the first run publishes a private package, change visibility and rerun the publish job. The workflow only emits app pins after both images can be pulled anonymously.
5. Copy the `compiler-image-digests` artifact into `image-digests.json`, run the live integration test below, and ship the app with the updated pins. Keep the release records with the release notes and retain the GHCR versions referenced by supported app releases. Existing app releases continue to reference their original digest until updated.

## Local development before publication

Debug builds can use a locally built image when there is no published digest for the selected engine. Build from the same pinned inputs as CI and record the full ID that Docker reports. From the repository root in PowerShell:

```powershell
$inputs = Get-Content docker/cpp/build-inputs.json -Raw | ConvertFrom-Json
$platform = switch (docker info --format '{{.Architecture}}') {
    { $_ -in 'x86_64', 'amd64' } { 'linux/amd64' }
    { $_ -in 'aarch64', 'arm64' } { 'linux/arm64' }
    default { throw 'The compiler requires an AMD64 or ARM64 Linux Docker Engine.' }
}
docker buildx build --platform $platform --load --tag batchgrade-cpp:dev `
    --build-arg "DEBIAN_BASE=$($inputs.base)" `
    --build-arg "DEBIAN_SNAPSHOT=$($inputs.debianSnapshot)" `
    --build-arg "SECURITY_SNAPSHOT=$($inputs.securitySnapshot)" docker/cpp
if ($LASTEXITCODE -ne 0) { throw 'The local compiler build failed.' }
$compilerImageId = docker image inspect batchgrade-cpp:dev --format '{{.Id}}'
if ($compilerImageId -cnotmatch '^sha256:[0-9a-f]{64}$') { throw 'Docker did not return an image ID.' }
Set-Content -LiteralPath docker/cpp/compiler-image.local -Value $compilerImageId -Encoding ascii
```

On a native Linux host, you can also use the build script below and write the ID of `batchgrade-cpp-ci:amd64` or `batchgrade-cpp-ci:arm64` to `docker/cpp/compiler-image.local`. The file is gitignored. Select **Refresh** in BatchGrade to run the isolation probe against the pinned local image. Production builds require a published digest.

## Compile and run a file

Choose a single `.cpp` file and select **Compile and run**. BatchGrade reads up to 256 KiB of source and compiles it with C++17. It runs the resulting executable in a separate container with empty standard input and displays compiler diagnostics, program output, and exit codes. Compilation has a 60-second limit. The program has a 3-second limit and up to 64 KiB each for stdout and stderr.

## Real Docker verification

From `src-tauri`, run this on a disposable Linux Docker Engine that does not already contain the pinned image. It checks missing-image detection, explicit download, readiness, and cleanup after a failed probe, a startup failure, and a deadline.

```sh
cargo test --locked cpp_environment_real_docker -- --ignored
```

To build and test an image locally on a native Linux host with Docker Buildx, Skopeo, and jq installed, run `bash docker/cpp/build-and-test.sh amd64 /tmp/batchgrade-compiler` from the repository root. Use `arm64` on ARM64. The build smoke test uses a fixed repository fixture. The desktop probe runs only the compiler version command.

To exercise the same probe and cleanup code before publication, set `BATCHGRADE_TEST_COMPILER_IMAGE` to a locally built compiler image and run the ignored test. This skips the registry and digest checks.

## Probe recovery and isolation limits

BatchGrade containers use no restart policy and have container-side deadlines. If BatchGrade or Docker stops during a job, list candidates with `docker ps -a --filter label=org.batchgrade.cpp.job` on the selected engine. Inspect the container ID and confirm its `batchgrade-cpp-<stage>-<uuid>` name and matching `org.batchgrade.cpp.job` label before using `docker rm -f <container-id>`. Keep containers from active BatchGrade sessions running.

BatchGrade trusts the selected daemon and the host kernel or Docker Desktop Linux VM. Container controls reduce exposure to student code. Keep Docker and the host or VM kernel patched separately from the image.
