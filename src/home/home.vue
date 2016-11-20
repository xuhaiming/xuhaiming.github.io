<template>
    <transition name="fade">
        <div>
            <navigation />
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
import Navigation from './navigation.vue'
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
    Navigation,
    Banner,
    PostList,
    MiddleContainer,
    AboutMe,
    BottomContainer,
    FooterContainer
  }
}
</script>
