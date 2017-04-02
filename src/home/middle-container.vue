<template>
  <scroll-parallax image-src="banner-2.jpg" image-alt="Responsive Image">
    <div class="container">
      <div class="row center">
        <h5 class="header col s12 light">Develop native or web applications across various of platforms</h5>
      </div>
    </div>
  </scroll-parallax>
</template>

<script>
import ScrollParallax from '../components/scroll-parallax.vue'

export default {
  name: 'middleContainer',
  components: {
    ScrollParallax
  }
}
</script>
