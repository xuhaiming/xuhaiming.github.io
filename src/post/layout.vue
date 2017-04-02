<template>
  <transition name="fade">
    <div>
      <navigation />
      <div class="container">
        <div class="post-page z-depth-2">
          <h1>{{ post.title }}</h1>
          <p>{{ post.date }}</p>
          <div v-show="content" v-html="content"></div>

          <div v-show="!content" class="loader-container">
            <div class="preloader-wrapper big active">
              <div class="spinner-layer spinner-blue-only">
                <div class="circle-clipper left">
                  <div class="circle"></div>
                </div>
                <div class="gap-patch">
                  <div class="circle"></div>
                </div>
                <div class="circle-clipper right">
                  <div class="circle"></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <footer-container />
    </div>
  </transition>
</template>

<script>
import axios from 'axios'
import marked from 'marked'
import hljs from 'highlightjs'
import posts from '../config/posts'
import Navigation from '../home/navigation.vue'
import FooterContainer from '../home/footer-container.vue'

export default {
  data() {
    return {
      post: posts.find(p => p.id === this.$route.params.id),
      content: ''
    }
  },
  components: {
    Navigation,
    FooterContainer
  },
  created() {
    axios.get(`/markdowns/${this.$route.params.id}.md`)
      .then(response => {
        this.content = marked(response.data)
        this.$nextTick(() => {
          this.$el.querySelectorAll('pre code').forEach(block => {
            hljs.highlightBlock(block)
          })
      })
    })
  }
}
</script>

<style>
@import '../styles/core.css';

.post-page {
  margin: 20px 0;
  padding: 10px 20px 20px;

  & h1 {
    font-size: 1.8rem;
    margin: 1rem 0;
  }

  & .loader-container {
    padding: 20px;
    text-align: center;
  }
}

code {
  color: var(--code-color);
}
</style>
