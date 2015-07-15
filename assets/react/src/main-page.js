class MainPage extends React.Component {
    initializeRoute() {
        var viewBlogs = function (blogId) {
            this.setState({
                onMainContainer: false
            });

        }.bind(this);

        var routes = {
            'blog/:blogId': viewBlogs
        };

        var router = Router(routes);

        router.init();
    }

    componentDidMount() {
        this.initializeRoute();
    }

    constructor() {
        super();

        this.state = {
            onMainContainer: true
        };
    }

    render() {
        return (
            <div>
                <Header isOnHomePage={this.state.onMainContainer}/>
                {this.state.onMainContainer ? <MainContainer /> : <BlogContainer />}
                <Footer />
            </div>
        );
    }
}

React.render(<MainPage />, document.getElementById('main-page'));