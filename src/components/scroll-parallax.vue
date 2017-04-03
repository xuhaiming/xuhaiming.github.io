<template>
  <div class="parallax-container" :class="customClassObject">
    <div class="section no-pad-bot vertical-center">
      <slot></slot>
    </div>
    <div class="parallax">
      <img :src="getImgUrl(imageSrc)" :alt="imageAlt" :style="{ top: `${top}px` }">
    </div>
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
    },
    customClassObject: {
      type: Object
    }
  },
  data() {
    return {
      ticking: false,
      top: 0
    }
  },
  mounted() {
    this.initializeRequestAnimationFrame()
    window.addEventListener('scroll', this.scrollHandler)
  },
  methods: {
    getImgUrl(src) {
      const images = require.context('../assets/', false, /\.*$/)
      return images(`./${src}`)
    },
    initializeRequestAnimationFrame() {
      const defaultRequestAnimationFrame = f => setTimeout(f, 1000 / 60)

      window.requestAnimationFrame = window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        defaultRequestAnimationFrame
    },
    getDocumentHeight() {
      const body = document.body
      const html = document.documentElement

      return Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      )
    },
    updatePosition() {
      const imageHeight = this.$el.querySelector('img').clientHeight
      const containerHeight = this.$el.clientHeight
      const windowHeight = window.innerHeight
      const containerOffset = this.$el.offsetTop
      const windowOffset = document.documentElement.scrollTop || document.body.scrollTop
      const scrollArea = imageHeight - containerHeight
      const scrollTopStartPoint = Math.max(containerOffset - windowHeight, 0)
      const scrollTopEndPoint = Math.min(containerOffset + containerHeight, this.getDocumentHeight() - windowHeight)

      this.top = -scrollArea * (windowOffset - scrollTopStartPoint) / (scrollTopEndPoint - scrollTopStartPoint)
    },
    scrollHandler() {
      if (!this.ticking) {
        window.requestAnimationFrame(() => {
          this.updatePosition()
          this.ticking = false
        });
      }
      this.ticking = true
    }
  }
}
</script>

<style>
.parallax-container {
  min-height: 550px;
  line-height: 0;
  height: auto;
  color: rgba(255, 255, 255, .9);
  width: 100%;

  & .section {
    width: 100%;
  }

  & .parallax img {
    display: block;
  }
}
</style>
