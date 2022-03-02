# Words

## Usage

```sh
cd FluidFramework.Tiger
npm run clean
npm install
npm run build:fast
alias fb='clear && node "$(git rev-parse --show-toplevel)/node_modules/.bin/fluid-build"'
fb --all @fluid-experimental/propdbg
```

Terminal 1

```sh
npx tinylicious@latest
```

Terminal 2

```sh
cd FluidFramework.Tiger/experimental/PropertyDDS/examples/propdbg
npm start
```
