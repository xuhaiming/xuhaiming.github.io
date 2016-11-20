<template>
    <div class="container post-list">
        <div class="section">
            <h4 class="center">Posts</h4>
            <ul class="row">
                <li v-for="post in posts" class="post col s12 m4" @click='onPostClick(post)'>
                    <div class="card hoverable">
                        <div class="card-image">
                            <img src="../assets/banner-1.jpg">
                        </div>
                        <div class="card-content">
                            <h5 class="post-title">{{post.title}}</h5>
                            <p>{{post.description}}</p>
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import posts from '../config/posts'

export default {
    data() {
        return { posts }
    },
    methods: {
        onPostClick(post) {
            this.$router.push(`post/${post.id}`)
        }
    }
}
</script>

<style>

.post-list {
    & .post {
        cursor: pointer;
    }

    & .post-title {
        font-size: 1.4rem;
    }
}

</style>
