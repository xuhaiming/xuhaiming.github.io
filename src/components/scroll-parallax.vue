<template>
  <div class="parallax-container">
    <div class="section no-pad-bot vertical-center">
      <slot></slot>
    </div>
    <div class="parallax"><img :src="getImgUrl(imageSrc)" :alt="imageAlt"></div>
  </div>
</template>

<script>
export default {
  name: 'scrollParallax',
  props: {
    imageSrc: {
      type: String,
      required: true
    },
    imageAlt: {
      type: String,
      required: true
    }
  },
  methods: {
    getImgUrl(src) {
      const images = require.context('../assets/', false, /\.*$/)
      return images(`./${src}`)
    }
  }
}
</script>

<style>

</style>
