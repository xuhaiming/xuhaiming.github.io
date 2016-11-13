<template>
  <div id="app">
    <navigation />
    <router-view></router-view>
    <footer-container />
  </div>
</template>

<script>
import Navigation from './home/navigation.vue'
import FooterContainer from './home/footer-container.vue'

export default {
  name: 'app',
  data() {
    return {}
  },
  components: {
    Navigation,
    FooterContainer
  },
  mounted() {
    $('.button-collapse').sideNav()
    $('.parallax').parallax()

    $('#index-banner-section').fadeIn('slow')
    $('#post-title').fadeIn('slow')
    Materialize.showStaggeredList($('#post-list'))

    var options = [{
      selector: '#middle-container', offset: 350, callback(el) {
        $('#middle-section').fadeIn('slow')
      }
    }, {
      selector: '#about-me', offset: 200, callback(el) {
        $('#about-me-section').fadeIn('slow')
      }
    }, {
      selector: '#bottom-container', offset: 350, callback(el) {
        $('#bottom-section').fadeIn('slow')
      }
    }]
    Materialize.scrollFire(options)
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

footer.page-footer {
  margin: 0;
}

.hidden {
  display: none;
}

#post-list > li {
  opacity: 0;
}

#about-me {
  min-height: 250px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity .5s
}

.fade-enter, .fade-leave-active {
  opacity: 0
}

</style>
