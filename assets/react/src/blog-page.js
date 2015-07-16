class BlogPage extends React.Component {
    render() {
        return (
            <div>
                <Header isOnMainPage={false}/>
                <BlogContainer />
                <Footer />
            </div>
        );
    }
}

React.render(<BlogPage />, document.getElementById('blog-page'));