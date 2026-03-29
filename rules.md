# VeeFriends Series 2 TCG - Compete & Collect
## Official Rules Summary

**VeeFriends Compete & Collect** is a fast-paced, strategic 2-player trading card game. Each player builds a 20-card deck and competes to be the first to collect **7 points in a single attribute** (Aura, Skill, or Stamina).

### Objective
The first player to reach **7 points in any one attribute** (Aura, Skill, or Stamina) wins the game.

### Deck Building Rules
- Each deck must contain exactly **20 cards**.
- Only **one card per character** is allowed (you cannot use both Core and Rare versions of the same VeeFriend).
- Maximum **15 Rarity Points (RP)** per deck.
  - Core = 0 RP
  - Rare = 2 RP
  - Very Rare = 3 RP
  - Epic = 4 RP
  - Spectacular = 5 RP

### Card Components
Every card has:
- **Name**
- **Three Attributes**: Aura, Skill, Stamina
- **Rarity** (Core, Rare, Very Rare, Epic, Spectacular)
- **Rarity Points** value
- **Base Score** (Aura + Skill + Stamina)

**Rarity Bonuses** (applied during Sprint Score):
- Rare: +25%
- Very Rare: +50%
- Epic: +100%
- Spectacular: +300%

### Gameplay (Turn Structure)

1. **Draw Phase**  
   Both players secretly draw the top card from their deck (kept hidden until revealed).

2. **Challenge Phase** (Attacker's turn)  
   The attacker chooses one attribute to challenge: **Aura**, **Skill**, or **Stamina**.

3. **Defense Phase**  
   The defender can **Accept** or **Decline** the challenge.
   - If **Accepted**: Both players reveal their cards. The higher value in the chosen attribute wins 1 point in that attribute.
   - If **Declined**: The attacker may choose a different attribute or force a **Total Score** comparison (Sprint Score).

4. **Resolution**  
   - Winner takes the point.
   - Both played cards go to the **Graveyard** (discard pile).
   - Turn passes to the other player (they become the attacker).

### Special Rules

- **Sprint Score** (once per game)  
  Instead of challenging a single attribute, the player can choose to compare the **total score** of both cards (base attributes + rarity bonus).

- **Ties**  
  If both cards have the same value in the challenged attribute, the round is replayed. The winner of the replay takes the point.

- **Graveyard**  
  All played cards are placed face-up in the Graveyard and cannot be used again.

### Winning the Game
The game ends immediately when one player reaches **7 points in any single attribute** (Aura, Skill, or Stamina).

---

**Notes for Development:**
- Games typically last 10–20 minutes.
- First player is determined by Rock-Paper-Scissors (or random in digital version).
- The digital version must enforce all deck-building rules (20 cards, unique characters, ≤15 RP).

This document should be used as the single source of truth for implementing gameplay logic, deck validation, turn flow, scoring, and win conditions.