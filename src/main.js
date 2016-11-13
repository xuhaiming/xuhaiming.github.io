import Vue from 'vue'
import VueRouter from 'vue-router'
import App from './App.vue'
import Home from './home/home.vue'

Vue.use(VueRouter)

const Foo = { template: '<transition name="fade" mode="out-in"><div><div>foo</div><router-link to="/">Home</router-link></div></transition>' }

const routes = [
  { path: '/', component: Home },
  { path: '/foo', component: Foo },
  { path: '/*', redirect: '/' }
]

const router = new VueRouter({
  routes
})

new Vue({
  el: '#app',
  router,
  render: h => h(App)
})
