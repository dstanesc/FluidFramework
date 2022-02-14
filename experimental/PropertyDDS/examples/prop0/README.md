# Prop0

Minimal demonstration of `PropertyDDS` usage. Leverages OOTB data binding.

See also the documented [isolation issue](#isolation-issue)

## Data Model

```js
export default {
    typeid: "hex:dice-1.0.0",
    inherits: "NamedProperty",
    properties: [
        { id: "diceValue", typeid: "Int32" }
    ],
};
```

## Build

```sh
cd FluidFramework.Debug
git switch pdds-uncommitted-behavior
npm run clean
npm install
npm run build:fast
alias fb='clear && node "$(git rev-parse --show-toplevel)/node_modules/.bin/fluid-build"'
fb --all @fluid-experimental/prop0
```

## Usage

Terminal 1

```sh
npx tinylicious
```

Terminal 2

```sh
cd FluidFramework.Debug/experimental/PropertyDDS/examples/prop0
npm start
```

Your default browser will open to [http://localhost:8080/](http://localhost:8080/).
Click on the red number to update the value.


## Isolation Issue

Created a [short video](./pdds0.mp4) which documents the unexpected transaction isolation policy.

### Note

The current findings build upon longer lived edit sessions and manual commits. It is our belief however that same behavior will manifest as well, this time as more difficult to detect race conditions, even with shorter edit sessions and automated commits.

### Current Behavior

1. Client C1 modifies the dice value. No commit.
2. Client C2 modifies the dice value and commits. The commit is reflected locally (C2) while the C1 state remains unchanged.
3. Client C1 commits. C1 local state reflects intended C1 change. C2 local state remains unchanged. Opening a third client (C3) would prove that the actual state of DDS is the one of C2 while C1 seems out of synch.
4. Client C2 modifies the dice value once again and commits. This time C1 state is updated with the most recent state from C2, also meaning C1 pending changes simply vanish. Notable is also the inconsistency in behavior - while first C2 commit was not reflected by C1 state update, second C2 commit modified current C1 state.

### Expected Behavior

The fundamental question is what should be the expected behavior when one of the clients (C1) has pending local changes whereas another (remote) client (C2), starting the transaction/updates after C1 is committing earlier than C1.

We believe that the correct client transactional model should reflect the snapshot isolation policy. That is queries are seeing a consistent and immutable snapshot of the local data (captured when the transaction has been started). Coupled with a traditional LWW conflict resolution policy would suggest that the last transaction (client) to commit the changes will win the race.

Following above reasoning, the expected behavior is:

1. Client C1 modifies the dice value. No commit.
2. Client C2 modifies the dice value and commits. The commit is reflected locally (C2) while the C1 state remains unchanged.
3. Client C1 commits. C1 local state reflects intended C1 change. __C2 local state is updated to C1 state__.

