import Vue from 'vue'
import VueRouter from 'vue-router'
import Vuex from 'vuex'
import App from './App.vue'
import Home from './home/home.vue'
import Post from './post/layout.vue'

Vue.use(VueRouter)
Vue.use(Vuex)

const routes = [
  { path: '/', component: Home },
  { path: '/post/:id', component: Post },
  { path: '/*', redirect: '/' }
]

const router = new VueRouter({
  routes
})

const store = new Vuex.Store({
  state: {
    count: 31
  },
  mutations: {
    increment(state) {
      state.count++
    }
  }
})

new Vue({
  el: '#app',
  router,
  store,
  render: h => h(App)
})
