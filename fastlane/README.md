fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios beta

```sh
[bundle exec] fastlane ios beta
```

iOS → TestFlight

### ios release

```sh
[bundle exec] fastlane ios release
```

iOS → App Store (uploads the build; submit for review in App Store Connect)

----


## Android

### android beta

```sh
[bundle exec] fastlane android beta
```

Android → Play internal testing track

### android release

```sh
[bundle exec] fastlane android release
```

Android → Play production track (uploaded as a draft; roll out in Play Console)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
