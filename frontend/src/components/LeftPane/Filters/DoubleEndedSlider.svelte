<script lang="ts">
  /**
   * Adapted from:
   * https://github.com/carbon-design-system/carbon-components-svelte/blob/master/src/Slider/Slider.svelte
   */

  /** Set the maximum slider value */
  export let max: number = 100;

  /** Specify the label for the max value */
  export let maxLabel: string = '';

  /** Set the minimum slider value */
  export let min: number = 0;

  /** Specify the label for the min value */
  export let minLabel: string = '';

  export let value: [number, number] = [min, max];

  /** Set the step value */
  export let step: number = 1;

  /** Set to `true` to disable the slider */
  export let disabled: boolean = false;

  /**
   * Set to `true` for the slider to span
   * the full width of its containing element.
   */
  export let fullWidth: boolean = false;

  /** Set an id for the slider div element */
  export let id = 'ccs-' + Math.random().toString(36);

  let trackRef: HTMLDivElement | null = null as HTMLDivElement | null;
  let dragging: false | 'left' | 'right' = false;
  let holding: false | 'left' | 'right' = false;

  const startDragging = () => {
    dragging = holding;
  };

  const startHolding = (side: 'left' | 'right') => {
    holding = side;
  };

  function stopHolding() {
    holding = false;
    dragging = false;
  }

  function move() {
    if (holding) {
      startDragging();
    }
  }

  const calcValue = (e: any): number => {
    if (!trackRef) {
      return min;
    }

    const offsetX = e.touches ? e.touches[0].clientX : e.clientX;
    const { left, width } = trackRef.getBoundingClientRect();
    let nextValue = min + Math.round(((max - min) * ((offsetX - left) / width)) / step) * step;

    if (nextValue <= min) {
      nextValue = min;
    } else if (nextValue >= max) {
      nextValue = max;
    }

    return nextValue;
  };

  function calcAndSetValue(e: any, side: 'left' | 'right') {
    if (disabled || !trackRef) return;

    let nextValue = calcValue(e);

    if (side === 'left') {
      nextValue = nextValue > value[1] ? value[1] : nextValue;
    } else {
      nextValue = nextValue < value[0] ? value[0] : nextValue;
    }

    value[side === 'left' ? 0 : 1] = nextValue;
  }

  $: labelId = `label-${id}`;
  $: range = max - min;
  $: leftLeft = ((value[0] - min) / range) * 100;
  $: rightLeft = ((value[1] - min) / range) * 100;
  $: {
    if (value[0] < min) {
      value[0] = min;
    } else if (value[0] > max) {
      value[0] = max;
    }

    if (value[1] < min) {
      value[1] = min;
    } else if (value[1] > max) {
      value[1] = max;
    }

    if (dragging) {
      calcAndSetValue(event, dragging);
      dragging = false;
    }
  }

  const handlePointerDown = (evt: MouseEvent | TouchEvent) => {
    if (disabled || !trackRef) return;

    // determine if the click was closer to the left or right thumb
    const posVal = calcValue(evt);
    const minDiff = Math.abs(posVal - value[0]);
    const maxDiff = Math.abs(posVal - value[1]);
    const side = (() => {
      if (minDiff === maxDiff) {
        return posVal < value[0] ? 'left' : 'right';
      }
      return minDiff < maxDiff ? 'left' : 'right';
    })();

    startHolding(side);
    value[side === 'left' ? 0 : 1] = posVal;
  };
</script>

<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<svelte:window
  on:mousemove={move}
  on:touchmove={move}
  on:mouseup={stopHolding}
  on:touchend={stopHolding}
  on:touchcancel={stopHolding}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div class:bx--form-item={true} {...$$restProps}>
  <div {id} class:bx--slider-container={true} style:width={fullWidth ? '100%' : undefined}>
    <span class:bx--slider__range-label={true}>{minLabel || min}</span>
    <div
      role="presentation"
      tabindex="-1"
      class:bx--slider={true}
      class:bx--slider--disabled={disabled}
      style:max-width={fullWidth ? 'none' : undefined}
      on:mousedown={startDragging}
      on:mousedown={handlePointerDown}
      on:touchstart={handlePointerDown}
    >
      <div
        role="slider"
        tabindex="0"
        class:bx--slider__thumb={true}
        style:left="{leftLeft}%"
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value[0]}
        aria-labelledby={labelId}
      ></div>
      <div
        role="slider"
        tabindex="0"
        class:bx--slider__thumb={true}
        style:left="{rightLeft}%"
        aria-valuemax={max}
        aria-valuemin={min}
        aria-valuenow={value[0]}
        aria-labelledby={labelId}
      ></div>
      <div bind:this={trackRef} class:bx--slider__track={true}></div>
      <div
        class:bx--slider__filled-track={true}
        style:transform="translate({leftLeft}%, -50%) scaleX({(rightLeft - leftLeft) / 100})"
      ></div>
    </div>
    <span class:bx--slider__range-label={true}>{maxLabel || max}</span>
  </div>
</div>

<style lang="css">
  :global(.bx--slider__range-label) {
    display: block;
    margin: 0 !important;
    min-width: 24px;
    max-width: 24px;
    text-align: center;
    font-size: 13px;
  }
</style>
