<script setup>
import { computed } from 'vue'

const props = defineProps({
  entries: {
    type: Array,
    required: true,
    default: () => []
  }
})

const topThree = computed(() => props.entries.slice(0, 3))

const getPodiumPosition = (rank) => {
  // Order for visual podium: 2nd (left), 1st (center, tallest), 3rd (right)
  return rank
}

const getPodiumHeight = (rank) => {
  switch (rank) {
    case 1: return '180px'
    case 2: return '140px'
    case 3: return '110px'
    default: return '80px'
  }
}

const getMedalColor = (rank) => {
  switch (rank) {
    case 1: return 'gold'
    case 2: return 'silver'
    case 3: return 'bronze'
    default: return 'default'
  }
}
</script>

<template>
  <div class="podium-container">
    <div v-if="topThree.length === 0" class="empty-podium">
      <p>No top performers yet this month</p>
    </div>
    
    <div v-else class="podium">
      <!-- 2nd Place (Left) -->
      <div v-if="topThree[1]" class="podium-position" :style="{ order: 1 }">
        <div class="winner-card" :class="`medal-${getMedalColor(2)}`">
          <div class="medal-icon">🥈</div>
          <div class="rank-badge">2nd</div>
          <div class="winner-info">
            <div class="username">{{ topThree[1].username }}</div>
            <div class="drinks-count">{{ topThree[1].totalDrinks }} drinks</div>
          </div>
        </div>
        <div class="podium-block" :style="{ height: getPodiumHeight(2) }">
          <div class="podium-rank">2</div>
        </div>
      </div>

      <!-- 1st Place (Center) -->
      <div v-if="topThree[0]" class="podium-position champion" :style="{ order: 2 }">
        <div class="crown">👑</div>
        <div class="winner-card" :class="`medal-${getMedalColor(1)}`">
          <div class="medal-icon">🥇</div>
          <div class="rank-badge champion-badge">Standaard-Drinker</div>
          <div class="winner-info">
            <div class="username">{{ topThree[0].username }}</div>
            <div class="drinks-count">{{ topThree[0].totalDrinks }} drinks</div>
          </div>
        </div>
        <div class="podium-block" :style="{ height: getPodiumHeight(1) }">
          <div class="podium-rank">1</div>
        </div>
      </div>

      <!-- 3rd Place (Right) -->
      <div v-if="topThree[2]" class="podium-position" :style="{ order: 3 }">
        <div class="winner-card" :class="`medal-${getMedalColor(3)}`">
          <div class="medal-icon">🥉</div>
          <div class="rank-badge">3rd</div>
          <div class="winner-info">
            <div class="username">{{ topThree[2].username }}</div>
            <div class="drinks-count">{{ topThree[2].totalDrinks }} drinks</div>
          </div>
        </div>
        <div class="podium-block" :style="{ height: getPodiumHeight(3) }">
          <div class="podium-rank">3</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.podium-container {
  padding: var(--spacing-xl) 0;
}

.empty-podium {
  text-align: center;
  padding: var(--spacing-3xl);
  color: var(--color-medium-grey);
}

.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-xl);
  min-height: 400px;
}

.podium-position {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  flex: 1;
  max-width: 200px;
  position: relative;
}

.podium-position.champion {
  max-width: 220px;
}

.crown {
  font-size: 2.5rem;
  animation: float 2s ease-in-out infinite;
  margin-bottom: var(--spacing-sm);
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.winner-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 2px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  width: 100%;
  text-align: center;
  box-shadow: var(--shadow-glass);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.winner-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  opacity: 0.8;
}

.winner-card.medal-gold {
  border-color: rgba(255, 215, 0, 0.6);
}

.winner-card.medal-gold::before {
  background: linear-gradient(90deg, #FFD700, #FFA500, #FFD700);
}

.winner-card.medal-silver {
  border-color: rgba(192, 192, 192, 0.6);
}

.winner-card.medal-silver::before {
  background: linear-gradient(90deg, #C0C0C0, #E8E8E8, #C0C0C0);
}

.winner-card.medal-bronze {
  border-color: rgba(205, 127, 50, 0.6);
}

.winner-card.medal-bronze::before {
  background: linear-gradient(90deg, #CD7F32, #E5B47F, #CD7F32);
}

.winner-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.45);
}

.medal-icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-sm);
}

.champion .medal-icon {
  font-size: 3.5rem;
}

.rank-badge {
  background: rgba(5, 94, 104, 0.8);
  color: var(--color-white);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: var(--spacing-md);
  display: inline-block;
}

.champion-badge {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #000;
}

.winner-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.username {
  font-weight: 700;
  font-size: var(--font-size-lg);
  color: var(--color-white);
  word-break: break-word;
}

.champion .username {
  font-size: var(--font-size-xl);
}

.drinks-count {
  font-size: var(--font-size-sm);
  color: var(--color-teal);
  font-weight: 600;
}

.podium-block {
  width: 100%;
  background: var(--glass-bg-dark);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border-accent);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-glass);
}

.podium-rank {
  font-size: var(--font-size-4xl);
  font-weight: 800;
  color: var(--color-white);
  opacity: 0.3;
}

@media (max-width: 768px) {
  .podium {
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    min-height: 300px;
  }
  
  .podium-position {
    max-width: 140px;
  }
  
  .podium-position.champion {
    max-width: 160px;
  }
  
  .crown {
    font-size: 2rem;
  }
  
  .medal-icon {
    font-size: 2rem;
  }
  
  .champion .medal-icon {
    font-size: 2.5rem;
  }
  
  .username {
    font-size: var(--font-size-sm);
  }
  
  .champion .username {
    font-size: var(--font-size-base);
  }
  
  .drinks-count {
    font-size: var(--font-size-xs);
  }
}
</style>
