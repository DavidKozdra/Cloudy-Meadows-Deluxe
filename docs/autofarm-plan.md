# Cloudy Meadows: AutoFarm

AutoFarm is a separate endless automation ruleset served at `/autofarm/`. The route boots the same Cloudy Meadows client and directly reuses its HUD, renderers, sprites, farming, shops, robots, controls, lighting, and serialization. It has a separate world and save namespace and does not use the story deadline.

## Game pillars

1. **Explore an endless readable world.** Terrain, resource nodes, and market positions are generated deterministically in chunks. A world seed gives every multiplayer client the same untouched landscape without storing millions of tiles.
2. **Turn labor into a production line.** The player starts by clearing, tilling, planting, and harvesting manually. Chests and programmable robots gradually replace each manual action.
3. **Trade for expansion, not victory.** There is no final coin target. Money purchases more land productivity: seeds, storage, processors, robots, and command capacity. The long-term score is sustained coins per day.
4. **Build together without losing offline play.** Local saves make the game immediately playable. A named Cloudflare Durable Object room coordinates players and stores only world mutations.

## Current vertical slice

- Deterministic, on-demand Cloudy Meadows `Level` generation with grass, water, bushes, trees, and markets.
- A guaranteed starter market and additional procedural regional markets.
- Markets always include the existing fruit and vegetable stalls; the third shop is selected from farming, tools, construction, machinery, and robots.
- Existing hoe, shovel, seed, crop growth, harvesting, buying, and selling logic.
- Placeable chests and robots.
- The existing visual robot inventory/programmer and complete command item set.
- The exact Cloudy Meadows HUD, top-down renderer, optional WEBGL first-person renderer, sprites, sound, touch controls, controller support, and day/night lighting.
- Sparse generated-room persistence through the existing save/load serializer, isolated from the story-game save.
- A Cloudflare Durable Object and Pages Function deployment scaffold for the authoritative multiplayer milestone.

## Economy model

The economy should reward building reliable throughput rather than waiting. Raw crops have a small positive margin. Processing and diverse orders create larger margins, while robots and command upgrades are meaningful capital expenses.

| Layer | Inputs | Outputs | Purpose |
|---|---|---|---|
| Gathering | Time, shovel/axe durability | Wood, stone, scrap | Early construction and exploration income |
| Farming | Seed, tilled tile, growth time | Fruit and vegetables | Base renewable income |
| Processing | Crops, powered machine | Oil, juice, meals, seed surplus | Higher margin and automation complexity |
| Logistics | Robot, commands, chests | Continuous item movement | Removes player labor |
| Trading | Produced items, route access | Coins, contracts, rare parts | Funds the next production tier |

Markets use regional stock and demand. Basic food never disappears, so a new or stranded player can always recover. Rotating machinery encourages travel. A later contract board should buy bulk categories on deadlines without recreating the original game's single fail-state deadline.

## Multiplayer authority

One Durable Object instance will represent one named world. Untouched terrain stays procedural; the object will persist sparse mutations and relay player presence over hibernating WebSockets. The Worker and Pages binding are scaffolded, but the reused client is not yet connected: adapting the old client to server authority is intentionally the next milestone instead of maintaining a second game implementation.

Before opening public persistent servers, move these actions from client authority to Durable Object authority:

- wallet and shop transactions;
- inventories and chest contents;
- crop timers and robot simulation;
- ownership/permission checks;
- chunk compaction and inactive-farm simulation.

The target simulation model is one active tick per room, with robots grouped by chunk. Empty rooms schedule Durable Object alarms at a coarse interval so crops and production advance without paying for a continuous Worker.

## Delivery roadmap

### Milestone 1 — shared-client foundation (implemented)

Boot the existing game at `/autofarm`, generate deterministic rooms on demand, farm, trade, place storage, program robots, switch between the shared renderers, and persist to an isolated local save.

### Milestone 2 — real factory loop

- Add a build mode with fences, paths, sprinklers, composters, grinders, and veggie presses from Cloudy Meadows.
- Add item-bearing conveyor paths or hauling robots.
- Give chests filters and robot load/unload selectors.
- Add power from solar panels and robot charging.
- Connect the shared client to the room service and move inventory, crop, chest, robot, shop, and player state to server authority.

### Milestone 3 — trading world

- Regional market prices and daily bulk contracts.
- Traveling merchants with Cloudy Meadows NPCs and themed inventories.
- Player market stalls and cooperative orders.
- Map, waypoints, and delivery-route robots.

### Milestone 4 — scale and polish

- Chunk-level persistence/compaction and server alarms.
- Expand localization and AutoFarm-specific accessibility guidance using the existing settings systems.
- Optimize both the existing top-down and WEBGL first-person views for large automated farms.
- Server-side rate limits, signed player sessions, moderation tools, backups, and world resets.

## Cloudflare deployment

AutoFarm uses two deployments because Pages Functions can bind to a Durable Object but cannot define one inside the Pages project.

1. Deploy `autofarm-worker/wrangler.toml` as `cloudy-meadows-autofarm-world`.
2. Deploy the Pages project using the root `wrangler.toml`; its `AUTO_FARM_WORLD` binding points at that Worker.
3. For local multiplayer development, run the Durable Object Worker and Pages dev server in separate terminals using `npm run dev:autofarm:world` and `npm run dev:pages`.

The client falls back to its local save if the binding or WebSocket endpoint is unavailable.
