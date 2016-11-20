<template>
    <transition name="fade">
        <div>
            <banner />
            <post-list />
            <middle-container />
            <about-me />
            <bottom-container />
            <footer-container />
        </div>
    </transition>
</template>

<script>
import Banner from './banner.vue'
import PostList from './post-list.vue'
import MiddleContainer from './middle-container.vue'
import AboutMe from './about-me.vue'
import BottomContainer from './bottom-container.vue'
import FooterContainer from './footer-container.vue'

export default {
  data() {
    return {}
  },
  components: {
    Banner,
    PostList,
    MiddleContainer,
    AboutMe,
    BottomContainer,
    FooterContainer
  }
}
</script>
