class MainPage extends React.Component {
    render() {
        return (
            <div>
                <Header isOnMainPage={true}/>
                <MainContainer />
                <Footer />
            </div>
        );
    }
}

React.render(<MainPage />, document.getElementById('main-page'));