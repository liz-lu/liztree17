import { HDRLoader } from './HDRLoader.js?v=archive-20261109-playback-1';

// @deprecated, r180

class RGBELoader extends HDRLoader {

	constructor( manager ) {

		console.warn( 'RGBELoader has been deprecated. Please use HDRLoader instead.' );
		super( manager );

	}

}

export { RGBELoader };


