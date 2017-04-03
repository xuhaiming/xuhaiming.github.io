<template>
  <scroll-parallax image-src="banner-2.jpg" image-alt="Responsive Image" :custom-class-object="classObject">
    <div class="container">
      <div class="row center">
        <h5 class="header col s12 light">Develop responsive applications across various of platforms and devices</h5>
      </div>
    </div>
  </scroll-parallax>
</template>

<script>
import ScrollParallax from '../components/scroll-parallax.vue'

export default {
  name: 'middleContainer',
  data() {
    return {
      classObject: {
        'middle-container': true
      }
    }
  },
  components: {
    ScrollParallax
  }
}
</script>

<style>
.middle-container {
  min-height: 400px;
}
</style>
