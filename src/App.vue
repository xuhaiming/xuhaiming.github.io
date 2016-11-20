<template>
  <div id="app">
    <navigation />
    <router-view></router-view>
  </div>
</template>

<script>
import Navigation from './home/navigation.vue'

export default {
  name: 'app',
  data() {
    return {}
  },
  components: {
    Navigation
  }
}
</script>

<style>

p {
  line-height: 2rem;
}

.button-collapse {
  color: #26a69a;
}

.view-github {
  margin-top: 2em;
}

.parallax-container {
  min-height: 550px;
  line-height: 0;
  height: auto;
  color: rgba(255,255,255,.9);
  width: 100%;

  & .section {
    width: 100%;
  }
}

.vertical-center {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.parallax img {
  display: block;
}

footer.page-footer {
  margin: 0;
}

#about-me {
  min-height: 250px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .5s;
}

.fade-enter, .fade-leave-active {
  opacity: 0;
}

</style>
