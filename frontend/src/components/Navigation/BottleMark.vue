<script setup>
defineProps({
  // When true, the bottle pours: liquid rises and a glow blooms behind it
  poured: { type: Boolean, default: false },
})
</script>

<template>
  <svg
    class="bottle-mark"
    :class="{ poured }"
    viewBox="0 0 24 34"
    aria-hidden="true"
    focusable="false"
  >
    <!-- liquid rises from below the viewBox (clipped by the svg viewport) -->
    <g class="liquid-group">
      <path
        class="bottle-liquid"
        d="M9.6 3.6 L9.6 10.5 C9.6 13 5.7 14 5.7 17.2 L5.7 30 C5.7 31.2 6.7 32.2 7.9 32.2 L16.1 32.2 C17.3 32.2 18.3 31.2 18.3 30 L18.3 17.2 C18.3 14 14.4 13 14.4 10.5 L14.4 3.6 Z"
      />
      <line class="bottle-surface" x1="9.8" y1="5.4" x2="14.2" y2="5.4" />
    </g>
    <path
      class="bottle-glass"
      d="M8.5 2.8 L8.5 10 C8.5 12.6 4 13.6 4 17 L4 30.6 C4 31.95 5.05 33 6.4 33 L17.6 33 C18.95 33 20 31.95 20 30.6 L20 17 C20 13.6 15.5 12.6 15.5 10 L15.5 2.8 Z"
    />
    <line class="bottle-sheen" x1="6.6" y1="19.5" x2="6.6" y2="30" />
    <rect class="bottle-cap" x="8" y="0.5" width="8" height="2.3" rx="1" />
    <rect class="bottle-collar" x="8.2" y="2.8" width="7.6" height="1.1" rx="0.5" />
  </svg>
</template>

<style scoped>
.bottle-mark {
  width: 18px;
  height: 25.5px;
  flex: none;
  display: block;
  transition: filter 0.5s ease;
}

.bottle-mark.poured {
  filter: drop-shadow(0 0 6px rgba(48, 164, 108, 0.55));
}

.liquid-group {
  transform: translateY(112%);
  transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
}

.bottle-mark.poured .liquid-group {
  transform: translateY(0);
}

.bottle-liquid {
  fill: var(--green-8);
}

/* the light edge where liquid meets air */
.bottle-surface {
  stroke: var(--green-9);
  stroke-width: 1.2;
  stroke-linecap: round;
}

/* the bottle rim catching the backlight */
.bottle-glass {
  fill: none;
  stroke: var(--green-7);
  stroke-width: 1.2;
}

.bottle-sheen {
  stroke: var(--glass-border);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.bottle-cap {
  fill: var(--gray-7);
}

.bottle-collar {
  fill: var(--glass-border);
}

@media (prefers-reduced-motion: reduce) {
  .liquid-group {
    transition: none;
  }
}
</style>
