from __future__ import absolute_import, division, print_function

from os import environ, getcwd
from os.path import join

import keras

import numpy as np
import sklearn as skl
import tensorflow as tf
import argparse
from keras.applications import NASNetMobile
from keras.layers import Dense, GlobalAveragePooling2D
from keras.metrics import binary_accuracy, binary_crossentropy
from keras.models import Model
from keras.optimizers import Adam
from keras.preprocessing.image import ImageDataGenerator
from flask import Flask, jsonify, request
from PIL import Image
from skimage.transform import resize

np.set_printoptions(precision=4)

environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
print("tf : {}".format(tf.__version__))
print("keras : {}".format(keras.__version__))
print("numpy : {}".format(np.__version__))
print("sklearn : {}".format(skl.__version__))

# Load Model
IMG_HEIGHT = 224
IMG_WIDTH = IMG_HEIGHT
CHANNELS = 3
DIMS = (IMG_HEIGHT, IMG_WIDTH, CHANNELS)

MODEL_TO_EVAL = './models/NASNetMobile.hdf5'

base_model = NASNetMobile(input_shape=DIMS, weights='imagenet', include_top=False)
x = base_model.output
x = GlobalAveragePooling2D(name='avg_pool')(x)  # comment for RESNET
x = Dense(1, activation='sigmoid', name='predictions')(x)

model = Model(inputs=base_model.input, outputs=x)
model.load_weights(MODEL_TO_EVAL)
model.compile(optimizer=Adam(lr=1e-3), loss=binary_crossentropy, metrics=['binary_accuracy'])
model._make_predict_function()

app = Flask(__name__)

@app.route("/score/")
def score_image():
    filename = request.args['file']

    image = Image.open(filename) 
    image_array = np.asarray(image.convert("RGB"))
    image_array = image_array / 255.
    image_array = resize(image_array, [224,224])
    image_array = np.expand_dims(image_array, axis=0)

    print("** make prediction **")
    y_pred = model.predict(image_array)
    if y_pred > 0.5:
        prediction = "Abnormal"
    else:
        prediction = "Normal"

    print("Model score for image is: {}".format(y_pred))

    return jsonify(prediction)

if __name__ == "__main__":    
    app.run(port=8001)
